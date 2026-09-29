/**
 * @fileoverview Expiry lock enforcement at the Server Action seam
 * (subscription-billing issue 09)
 *
 * CONTRACT UNDER TEST — "Boards with Members become read-only for
 * everyone at expiry, Boards without Members stay writable":
 * 1. A write to a Board WITH Members whose Owner's period has ended is
 *    denied to the Owner AND to Members alike (authorization error, no
 *    database write)
 * 2. A write to a Board WITHOUT Members succeeds after expiry — the
 *    free tier keeps solo work editable
 * 3. A write to a Board WITH Members succeeds while the Owner is Pro
 * 4. Nothing is hidden or deleted when a Board locks — only writes are
 *    refused (the read side is asserted in the board page suite: a
 *    lapsed Board still renders, with the lock handed to the UI)
 *
 * The exact expiry INSTANT belongs to the pure seam
 * (lib/__tests__/subscription.test.ts); here the clock is real, so
 * these tests pin the active / lapsed / with-members split.
 *
 * External behavior only — db and session mocked at the module boundary
 * (prior art: actions/__tests__/comments.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionResult } from '@/lib/errors'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), delete: vi.fn() },
  boardMember: { findFirst: vi.fn(), delete: vi.fn() },
  todo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  todoTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  comment: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  tag: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  activity: { create: vi.fn() },
  notification: { create: vi.fn() },
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

import { createTodo, deleteTodo } from '@/actions/todos'
import { createComment } from '@/actions/comments'
import { createTag } from '@/actions/tags'
import { renameBoard } from '@/app/actions/boards'
import { removeMember } from '@/app/actions/members'

const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const TODO_ID = 'todo_1'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

/**
 * Primes the Board the way the lock reads it: the Owner's period end
 * plus the member count. `subscriptionPeriodEnd: null` is a subscriber
 * who never paid; a past date is a lapsed one; a future date is Pro.
 */
function primeBoard({
  ownerId = OWNER_ID,
  memberCount = 0,
  subscriptionPeriodEnd = null as Date | null,
} = {}) {
  const board = {
    id: BOARD_ID,
    ownerId,
    name: 'Sprint 42',
    owner: { subscriptionPeriodEnd },
    _count: { members: memberCount },
  }
  prismaMock.board.findUnique.mockResolvedValue(board)
  prismaMock.board.findUniqueOrThrow.mockResolvedValue(board)
}

function primeMembership(memberUserIds: string[]) {
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { boardId: string; userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: where.boardId, userId: where.userId, joinedAt: new Date() }
        : null
  )
}

/** Asserts the refusal is the read-only lock, not some other failure. */
function expectLocked(result: ActionResult<unknown>) {
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.type).toBe('authorization')
    expect(result.error.message).toMatch(/read-only/i)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )
  prismaMock.comment.findMany.mockResolvedValue([])
  prismaMock.todo.findMany.mockResolvedValue([])
  prismaMock.todo.create.mockResolvedValue({ id: 'todo_new', boardId: BOARD_ID, assignee: null, tags: [] })
  prismaMock.todo.delete.mockResolvedValue({ id: TODO_ID })
  prismaMock.comment.create.mockResolvedValue({ id: 'c1', author: { id: MEMBER_ID, name: 'M', image: null } })
  prismaMock.tag.create.mockResolvedValue({ id: 'tag_new', boardId: BOARD_ID })
  prismaMock.board.update.mockResolvedValue({ id: BOARD_ID, name: 'Renamed' })
  prismaMock.boardMember.delete.mockResolvedValue({ id: 'bm_x' })
})

describe('expiry lock — Boards WITH Members deny writes at expiry', () => {
  it('denies an Owner creating a Todo on their own lapsed Board', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 2, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    primeMembership([])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Should not land' })

    expectLocked(result)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.todo.create).not.toHaveBeenCalled()
  })

  it('denies a Member creating a Todo on a lapsed Board', async () => {
    signIn(MEMBER_ID)
    primeBoard({ memberCount: 2, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    primeMembership([MEMBER_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Should not land' })

    expectLocked(result)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('denies a Member commenting on a lapsed Board', async () => {
    signIn(MEMBER_ID)
    primeBoard({ memberCount: 2, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    primeMembership([MEMBER_ID])
    prismaMock.todo.findUnique.mockResolvedValue({ id: TODO_ID, boardId: BOARD_ID, assigneeId: null })

    const result = await createComment({ todoId: TODO_ID, body: 'Should not land' })

    expectLocked(result)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('denies the Owner renaming a lapsed Board that has Members', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 1, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })

    const result = await renameBoard(BOARD_ID, 'Renamed')

    expectLocked(result)
    expect(prismaMock.board.update).not.toHaveBeenCalled()
  })

  it('denies the Owner removing a Member from a lapsed Board', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 1, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    prismaMock.boardMember.findFirst.mockResolvedValue({ id: 'bm_other', boardId: BOARD_ID, userId: 'user_other' })

    const result = await removeMember(BOARD_ID, 'user_other')

    expectLocked(result)
    expect(prismaMock.boardMember.delete).not.toHaveBeenCalled()
  })
})

describe('expiry lock — Boards WITHOUT Members stay writable', () => {
  it('lets the lapsed Owner keep editing their solo Board', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 0, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    primeMembership([])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Personal work' })

    expect(result.success).toBe(true)
    expect(prismaMock.todo.create).toHaveBeenCalledTimes(1)
  })

  it('lets a user who never subscribed edit their solo Board (free tier)', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 0, subscriptionPeriodEnd: null })
    primeMembership([])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Personal work' })

    expect(result.success).toBe(true)
  })

  it('lets the Owner rename their solo Board after expiry', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 0, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })

    const result = await renameBoard(BOARD_ID, 'Renamed')

    expect(result.success).toBe(true)
    expect(prismaMock.board.update).toHaveBeenCalledTimes(1)
  })
})

describe('expiry lock — Boards WITH Members stay writable while Pro', () => {
  it('lets a Pro Owner create a Todo on their team Board', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 3, subscriptionPeriodEnd: new Date(Date.now() + 60_000) })
    primeMembership([])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Team work' })

    expect(result.success).toBe(true)
    expect(prismaMock.todo.create).toHaveBeenCalledTimes(1)
  })

  it('lets a Member comment on a team Board while the Owner is Pro', async () => {
    signIn(MEMBER_ID)
    primeBoard({ memberCount: 3, subscriptionPeriodEnd: new Date(Date.now() + 60_000) })
    primeMembership([MEMBER_ID])
    prismaMock.todo.findUnique.mockResolvedValue({ id: TODO_ID, boardId: BOARD_ID, assigneeId: null })

    const result = await createComment({ todoId: TODO_ID, body: 'Team talk' })

    expect(result.success).toBe(true)
    expect(prismaMock.comment.create).toHaveBeenCalledTimes(1)
  })

  it('lets the Owner manage tags on their team Board while Pro', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 3, subscriptionPeriodEnd: new Date(Date.now() + 60_000) })

    const result = await createTag({ boardId: BOARD_ID, name: 'bug', color: '#FF0000' })

    expect(result.success).toBe(true)
    expect(prismaMock.tag.create).toHaveBeenCalledTimes(1)
  })
})

describe('expiry lock — nothing is deleted or hidden', () => {
  it('refuses a delete outright rather than deleting content on a locked Board', async () => {
    signIn(MEMBER_ID)
    primeBoard({ memberCount: 2, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })
    primeMembership([MEMBER_ID])
    prismaMock.todo.findUnique.mockResolvedValue({ id: TODO_ID, boardId: BOARD_ID })

    const result = await deleteTodo(TODO_ID)

    expectLocked(result)
    expect(prismaMock.todo.delete).not.toHaveBeenCalled()
    expect(prismaMock.activity.create).not.toHaveBeenCalled()
  })

  it('refuses tag creation on a locked Board (tags are Board content)', async () => {
    signIn(OWNER_ID)
    primeBoard({ memberCount: 2, subscriptionPeriodEnd: new Date(Date.now() - 60_000) })

    const result = await createTag({ boardId: BOARD_ID, name: 'bug', color: '#FF0000' })

    expectLocked(result)
    expect(prismaMock.tag.create).not.toHaveBeenCalled()
  })
})
