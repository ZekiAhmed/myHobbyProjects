/**
 * @fileoverview Server-entrypoint tests for the Comment create action
 *
 * CONTRACT UNDER TEST (createComment):
 * 1. A board Member (and Owner) can create a plain-text Comment on a Todo
 * 2. A non-member is rejected with an authorization error even with a valid Todo id
 * 3. Comment creation atomically emits an Activity row (comment created, actor, resource)
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: app/api/boards/[id]/__tests__/authz.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  todo: { findUnique: vi.fn() },
  board: { findUnique: vi.fn() },
  boardMember: { findFirst: vi.fn() },
  comment: { create: vi.fn() },
  activity: { create: vi.fn() },
  $transaction: vi.fn(),
}))
const revalidateTagMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))

import { createComment } from '@/actions/comments'

const TODO_ID = 'todo_1'
const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const STRANGER_ID = 'user_stranger'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function primeTodoBelongsToBoard() {
  prismaMock.todo.findUnique.mockResolvedValue({ id: TODO_ID, boardId: BOARD_ID })
}

function primeBoardOwnedBy(ownerId: string) {
  prismaMock.board.findUnique.mockResolvedValue({ id: BOARD_ID, ownerId })
}

function primeMembership(memberUserIds: string[]) {
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { boardId: string; userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: where.boardId, userId: where.userId, joinedAt: new Date() }
        : null
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      comment: { create: prismaMock.comment.create },
      activity: { create: prismaMock.activity.create },
    })
  )
  prismaMock.comment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'comment_1',
    body: data.body,
    todoId: data.todoId,
    authorId: data.authorId,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    author: { id: data.authorId, name: 'Member', image: null },
  }))
})

describe('createComment — authorization', () => {
  it('rejects a non-member even with a valid Todo id', async () => {
    signIn(STRANGER_ID)
    primeTodoBelongsToBoard()
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await createComment({ todoId: TODO_ID, body: 'Should not land' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe('createComment — authorized create', () => {
  it('lets a board Member create a Comment with preserved line breaks', async () => {
    signIn(MEMBER_ID)
    primeTodoBelongsToBoard()
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const body = 'Line one\nLine two\n\nLine four'
    const result = await createComment({ todoId: TODO_ID, body })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.body).toBe(body)
      expect(result.data.todoId).toBe(TODO_ID)
      expect(result.data.authorId).toBe(MEMBER_ID)
    }
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body, todoId: TODO_ID, authorId: MEMBER_ID }),
      })
    )
  })

  it('lets the board Owner create a Comment without a BoardMember row', async () => {
    signIn(OWNER_ID)
    primeTodoBelongsToBoard()
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([])

    const result = await createComment({ todoId: TODO_ID, body: 'Owner speaking' })

    expect(result.success).toBe(true)
    expect(prismaMock.comment.create).toHaveBeenCalledTimes(1)
  })

  it('rejects a whitespace-only body as a validation error', async () => {
    signIn(MEMBER_ID)

    const result = await createComment({ todoId: TODO_ID, body: '   \n  ' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
    }
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })
})

describe('createComment — Activity emission', () => {
  it('atomically writes a comment created Activity row alongside the Comment', async () => {
    signIn(MEMBER_ID)
    primeTodoBelongsToBoard()
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await createComment({ todoId: TODO_ID, body: 'Traced' })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.activity.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          boardId: BOARD_ID,
          actorId: MEMBER_ID,
          action: 'comment.created',
          resourceType: 'COMMENT',
          resourceId: 'comment_1',
        }),
      })
    )
  })

  it('revalidates the server cache for the Comment feed (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    primeTodoBelongsToBoard()
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    await createComment({ todoId: TODO_ID, body: 'Cache check' })

    expect(revalidateTagMock).toHaveBeenCalledWith('comments', 'max')
  })
})
