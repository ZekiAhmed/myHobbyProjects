/**
 * @fileoverview Server-entrypoint tests for Notifications (ticket 05)
 *
 * CONTRACT UNDER TEST:
 *
 * Assignment emission matrix (updateTodo / createTodo):
 * 1. Assigning a Todo to another user atomically persists exactly one
 *    Notification typed ASSIGNED, addressed to that user only
 * 2. Self-assignment produces no Notification row
 * 3. Bystanders (board owner, other members) receive no rows
 * 4. Non-assignment events (status, membership, tags, rename, comment)
 *    persist no rows
 *
 * Board/recipient cascade for Notification rows is a schema-level contract
 * (onDelete: Cascade) asserted in prisma/__tests__/schema.test.ts — it
 * cannot be observed through a mocked client, and spec §Testing Decisions
 * forbids a real database in unit tests.
 *
 * Notification read actions:
 * 5. markNotificationRead sets readAt on the acting user's row only
 * 6. A Notification addressed to someone else is rejected
 * 7. markAllNotificationsRead clears only the acting user's unread rows,
 *    in one call
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: actions/__tests__/comments.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  todo: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  board: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  boardMember: { findFirst: vi.fn(), delete: vi.fn() },
  tag: { create: vi.fn() },
  comment: { create: vi.fn() },
  todoTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  notification: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  activity: { create: vi.fn() },
  $transaction: vi.fn(),
}))
const revalidateTagMock = vi.hoisted(() => vi.fn())
const sendInvitationEmailMock = vi.hoisted(() => vi.fn())

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
vi.mock('@/lib/email', () => ({ sendInvitationEmail: sendInvitationEmailMock }))

import { createTodo, updateTodo } from '@/actions/todos'
import { markNotificationRead, markAllNotificationsRead } from '@/actions/notifications'
import { renameBoard } from '@/app/actions/boards'
import { removeMember } from '@/app/actions/members'
import { createTag } from '@/actions/tags'
import { createComment } from '@/actions/comments'

const TODO_ID = 'todo_1'
const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const ASSIGNEE_ID = 'user_assignee'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function primeTodo({ assigneeId = null, status = 'TO_DO' }: { assigneeId?: string | null; status?: string } = {}) {
  prismaMock.todo.findUnique.mockResolvedValue({
    id: TODO_ID,
    boardId: BOARD_ID,
    status,
    assigneeId,
  })
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
      todo: { create: prismaMock.todo.create, update: prismaMock.todo.update },
      board: { update: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })) },
      boardMember: { delete: prismaMock.boardMember.delete },
      tag: { create: prismaMock.tag.create },
      comment: { create: prismaMock.comment.create },
      notification: { create: prismaMock.notification.create },
      activity: { create: prismaMock.activity.create },
    })
  )
  prismaMock.todo.findMany.mockResolvedValue([])
  prismaMock.todo.update.mockImplementation(async ({ include }: { include?: unknown }) => ({
    id: TODO_ID,
    boardId: BOARD_ID,
    assignee: null,
    tags: [],
    include,
  }))
  prismaMock.todo.create.mockImplementation(async () => ({
    id: TODO_ID,
    boardId: BOARD_ID,
    assignee: null,
    tags: [],
  }))
  prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })
})

describe('updateTodo — assignment Notification emission matrix', () => {
  it('persists exactly one ASSIGNED Notification addressed to the new assignee only', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: null })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await updateTodo(TODO_ID, { assigneeId: ASSIGNEE_ID })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: ASSIGNEE_ID,
          actorId: MEMBER_ID,
          type: 'ASSIGNED',
          boardId: BOARD_ID,
          todoId: TODO_ID,
        },
      })
    )
  })

  it('writes the Notification row inside the same transaction as the assignment write', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: null })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    await updateTodo(TODO_ID, { assigneeId: ASSIGNEE_ID })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.todo.update).toHaveBeenCalledTimes(1)
    // both writes went through the tx handle handed to the single callback
    expect(prismaMock.notification.create.mock.calls[0][0]).toBeDefined()
  })

  it('produces no Notification row on self-assignment', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: null })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await updateTodo(TODO_ID, { assigneeId: MEMBER_ID })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('gives bystanders (board owner and other members) no rows', async () => {
    signIn(OWNER_ID)
    primeTodo({ assigneeId: null })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    await updateTodo(TODO_ID, { assigneeId: ASSIGNEE_ID })

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    const addresses = prismaMock.notification.create.mock.calls.map((call) => {
      const [{ data }] = call as [{ data: { userId: string } }]
      return data.userId
    })
    expect(addresses).toEqual([ASSIGNEE_ID])
    expect(addresses).not.toContain(OWNER_ID)
    expect(addresses).not.toContain(MEMBER_ID)
  })

  it('unassigning (assignee → null) produces no Notification row', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: ASSIGNEE_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await updateTodo(TODO_ID, { assigneeId: null })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('reassigning to a different user notifies only the new assignee', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: ASSIGNEE_ID })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID, 'user_assignee_2'])

    await updateTodo(TODO_ID, { assigneeId: 'user_assignee_2' })

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user_assignee_2', actorId: MEMBER_ID }),
      })
    )
  })

  it('a status change alone persists no Notification rows (non-assignment event)', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: ASSIGNEE_ID, status: 'TO_DO' })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await updateTodo(TODO_ID, { status: 'IN_PROGRESS' })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    // status change is still in the Activity taxonomy
    expect(prismaMock.activity.create).toHaveBeenCalledTimes(1)
  })

  it('revalidates the Notification server cache when a row is written (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: null })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    await updateTodo(TODO_ID, { assigneeId: ASSIGNEE_ID })

    expect(revalidateTagMock).toHaveBeenCalledWith('notifications', 'max')
  })

  it('does not touch the Notification cache when nothing is emitted', async () => {
    signIn(MEMBER_ID)
    primeTodo({ assigneeId: null, status: 'TO_DO' })
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    await updateTodo(TODO_ID, { status: 'DONE' })

    expect(revalidateTagMock).not.toHaveBeenCalledWith('notifications', 'max')
  })
})

describe('createTodo — assignment Notification emission', () => {
  it('persists one ASSIGNED Notification for a Todo created already assigned to someone else', async () => {
    signIn(MEMBER_ID)
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Assigned on create', assigneeId: ASSIGNEE_ID })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: ASSIGNEE_ID,
          actorId: MEMBER_ID,
          type: 'ASSIGNED',
          boardId: BOARD_ID,
          todoId: TODO_ID,
        },
      })
    )
  })

  it('produces no row when the creator assigns themself', async () => {
    signIn(MEMBER_ID)
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Self assigned', assigneeId: MEMBER_ID })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('produces no row for an unassigned Todo', async () => {
    signIn(MEMBER_ID)
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID, ASSIGNEE_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Unassigned' })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})

describe('non-assignment events — persist no Notification rows', () => {
  it('renaming a board persists no Notification row', async () => {
    signIn(OWNER_ID)
    prismaMock.board.findUniqueOrThrow.mockResolvedValue({ id: BOARD_ID, ownerId: OWNER_ID })

    const result = await renameBoard(BOARD_ID, 'Renamed')

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('creating a tag persists no Notification row', async () => {
    signIn(OWNER_ID)
    primeBoardOwnedBy(OWNER_ID)
    prismaMock.tag.create.mockResolvedValue({ id: 'tag_1', name: 'Bug', color: '#ef4444', boardId: BOARD_ID })

    const result = await createTag({ boardId: BOARD_ID, name: 'Bug', color: '#ef4444' })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('adding a comment persists no Notification row', async () => {
    signIn(MEMBER_ID)
    primeBoardOwnedBy(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo()
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment_1',
      todoId: TODO_ID,
      authorId: MEMBER_ID,
      body: 'On it',
      author: { id: MEMBER_ID, name: 'Member', image: null },
    })

    const result = await createComment({ todoId: TODO_ID, body: 'On it' })

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it('removing a member persists no Notification row', async () => {
    signIn(OWNER_ID)
    prismaMock.board.findUniqueOrThrow.mockResolvedValue({ id: BOARD_ID, ownerId: OWNER_ID })
    prismaMock.boardMember.findFirst.mockResolvedValue({
      id: 'bm_x',
      boardId: BOARD_ID,
      userId: MEMBER_ID,
    })
    prismaMock.boardMember.delete.mockResolvedValue({ id: 'bm_x' })

    const result = await removeMember(BOARD_ID, MEMBER_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })
})

describe('markNotificationRead — actor scoping', () => {
  const NOTIFICATION_ID = 'notif_1'

  function primeOwnedBy(userId: string, readAt: Date | null = null) {
    prismaMock.notification.findUnique.mockResolvedValue({
      id: NOTIFICATION_ID,
      userId,
      readAt,
    })
  }

  it('sets readAt on the acting user\'s own unread row', async () => {
    signIn(MEMBER_ID)
    primeOwnedBy(MEMBER_ID)

    const result = await markNotificationRead(NOTIFICATION_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: NOTIFICATION_ID, userId: MEMBER_ID, readAt: null },
        data: { readAt: expect.any(Date) },
      })
    )
  })

  it('rejects a Notification addressed to a different user', async () => {
    signIn(MEMBER_ID)
    primeOwnedBy(ASSIGNEE_ID)

    const result = await markNotificationRead(NOTIFICATION_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled()
  })

  it('rejects an unknown Notification id', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.findUnique.mockResolvedValue(null)

    const result = await markNotificationRead('missing')

    expect(result.success).toBe(false)
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled()
  })

  it('revalidates the Notification server cache (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    primeOwnedBy(MEMBER_ID)

    await markNotificationRead(NOTIFICATION_ID)

    expect(revalidateTagMock).toHaveBeenCalledWith('notifications', 'max')
  })
})

describe('markAllNotificationsRead — actor scoping', () => {
  it('clears only the acting user\'s unread rows in one call', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 })

    const result = await markAllNotificationsRead()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.count).toBe(3)
    }
    expect(prismaMock.notification.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MEMBER_ID, readAt: null },
        data: { readAt: expect.any(Date) },
      })
    )
  })

  it('never widens the where clause beyond the acting user', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    await markAllNotificationsRead()

    const { where } = prismaMock.notification.updateMany.mock.calls[0][0]
    expect(Object.keys(where)).toEqual(['userId', 'readAt'])
    expect(where.userId).toBe(MEMBER_ID)
  })

  it('revalidates the Notification server cache (two-cache rule)', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })

    await markAllNotificationsRead()

    expect(revalidateTagMock).toHaveBeenCalledWith('notifications', 'max')
  })
})
