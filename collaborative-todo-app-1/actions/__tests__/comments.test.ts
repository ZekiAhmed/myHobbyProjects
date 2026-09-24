/**
 * @fileoverview Server-entrypoint tests for the Comment create/edit/delete actions
 *
 * CONTRACT UNDER TEST:
 * createComment:
 * 1. A board Member (and Owner) can create a plain-text Comment on a Todo
 * 2. A non-member is rejected with an authorization error even with a valid Todo id
 * 3. Comment creation atomically emits an Activity row (comment created, actor, resource)
 *
 * updateComment:
 * 4. The author can edit their own Comment body (feed reflects the new text/updatedAt)
 * 5. Only the author — a non-author Member AND the board Owner are rejected
 * 6. A non-member is rejected with a valid Comment id
 * 7. No Activity row is written (comment edits are outside the ADR-0002 taxonomy)
 *
 * deleteComment:
 * 8. The author can delete their own Comment; the board Owner can delete any Comment
 * 9. An unrelated Member and a non-member are rejected
 * 10. Deletion hard-deletes the row (no tombstone/`deletedAt`) and atomically
 *     emits a comment deleted Activity row (actor, todo resource — never the body)
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
  comment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

import { createComment, updateComment, deleteComment } from '@/actions/comments'

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

function primeComment({
  id = 'comment_1',
  authorId,
  boardId = BOARD_ID,
}: {
  id?: string
  authorId: string
  boardId?: string
}) {
  prismaMock.comment.findUnique.mockResolvedValue({
    id,
    body: 'Original body',
    todoId: TODO_ID,
    authorId,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    todo: { id: TODO_ID, boardId },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      comment: {
        create: prismaMock.comment.create,
        update: prismaMock.comment.update,
        delete: prismaMock.comment.delete,
      },
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
  prismaMock.comment.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'comment_1',
      body: data.body,
      todoId: TODO_ID,
      authorId: MEMBER_ID,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      author: { id: MEMBER_ID, name: 'Member', image: null },
    })
  )
  prismaMock.comment.delete.mockResolvedValue({ id: 'comment_1' })
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

describe('updateComment — authorization', () => {
  it('lets the author edit their own Comment body', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await updateComment({ commentId: 'comment_1', body: 'Fixed typo\nNew line' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.body).toBe('Fixed typo\nNew line')
      expect(result.data.updatedAt).toBeInstanceOf(Date)
    }
    expect(prismaMock.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment_1' },
        data: { body: 'Fixed typo\nNew line' },
      })
    )
  })

  it('rejects a non-author Member editing another Comment', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: 'user_other_member' })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, 'user_other_member'])

    const result = await updateComment({ commentId: 'comment_1', body: 'Silently rewritten' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it('rejects the board Owner editing another author\'s Comment (Owner is not a co-author)', async () => {
    signIn(OWNER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await updateComment({ commentId: 'comment_1', body: 'Owner rewrite' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it('rejects a non-member even with a valid Comment id', async () => {
    signIn(STRANGER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await updateComment({ commentId: 'comment_1', body: 'Should not land' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only body as a validation error', async () => {
    signIn(MEMBER_ID)

    const result = await updateComment({ commentId: 'comment_1', body: '   \n  ' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
    }
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })
})

describe('updateComment — Activity and cache', () => {
  it('writes no Activity row (comment edits are outside the ADR-0002 taxonomy)', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await updateComment({ commentId: 'comment_1', body: 'Still no feed entry' })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.activity.create).not.toHaveBeenCalled()
  })

  it('revalidates the server cache for the Comment feed (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    await updateComment({ commentId: 'comment_1', body: 'Cache check' })

    expect(revalidateTagMock).toHaveBeenCalledWith('comments', 'max')
  })
})

describe('deleteComment — authorization', () => {
  it('lets the author delete their own Comment', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(true)
    expect(prismaMock.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment_1' } })
  })

  it('lets the board Owner delete any Comment on their board', async () => {
    signIn(OWNER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(true)
    expect(prismaMock.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment_1' } })
    expect(prismaMock.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: OWNER_ID, action: 'comment.deleted' }),
      })
    )
  })

  it('rejects an unrelated Member deleting someone else\'s Comment', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: 'user_other_member' })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, 'user_other_member'])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.comment.delete).not.toHaveBeenCalled()
    expect(prismaMock.activity.create).not.toHaveBeenCalled()
  })

  it('rejects a non-member even with a valid Comment id', async () => {
    signIn(STRANGER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.comment.delete).not.toHaveBeenCalled()
  })

  it('hard-deletes the Comment row outright — no tombstone column', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(true)
    expect(prismaMock.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment_1' } })
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
    expect(prismaMock.comment.delete.mock.calls[0][0]).not.toHaveProperty('data')
  })
})

describe('deleteComment — Activity emission', () => {
  it('atomically writes a comment deleted Activity row alongside the row removal', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await deleteComment('comment_1')

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.activity.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          boardId: BOARD_ID,
          actorId: MEMBER_ID,
          action: 'comment.deleted',
          // ADR-0001: the entry records *which todo* — the Comment row is
          // gone, so its id would dangle.
          resourceType: 'TODO',
          resourceId: TODO_ID,
        }),
      })
    )
    expect(prismaMock.activity.create.mock.calls[0][0].data).not.toHaveProperty('body')
  })

  it('revalidates the server cache for the Comment feed (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    primeComment({ authorId: MEMBER_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])

    await deleteComment('comment_1')

    expect(revalidateTagMock).toHaveBeenCalledWith('comments', 'max')
  })
})
