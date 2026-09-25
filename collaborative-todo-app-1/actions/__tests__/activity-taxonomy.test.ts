/**
 * @fileoverview Server-entrypoint tests for the ADR-0002 Activity taxonomy
 *
 * CONTRACT UNDER TEST:
 * 1. Every mutation inside the taxonomy persists exactly the expected Activity
 *    row (action, resource type/id, actor, board) in the same transaction as
 *    its domain write — the feed cannot drift from reality
 * 2. Mutations outside the taxonomy (field-level edits, reorders, structural
 *    actions the ADR deliberately excludes) persist NO Activity row
 * 3. Compliance columns are populated from day one: actor, board, resource
 *    type/id, timestamp, best-effort IP (ADR-0002)
 *
 * External behavior only — db, session, headers and email mocked at the module
 * boundary per spec §Testing Decisions (prior art: actions/__tests__/comments.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  boardMember: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  invitation: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  todo: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  todoTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  tag: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
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
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }),
}))
vi.mock('@/lib/email', () => ({ sendInvitationEmail: sendInvitationEmailMock }))

import { createBoard, renameBoard, deleteBoard, transferOwnership } from '@/app/actions/boards'
import { createInvitation, revokeInvitation, acceptInvitation } from '@/app/actions/invitations'
import { removeMember, leaveBoard } from '@/app/actions/members'
import {
  createTodo,
  updateTodo,
  deleteTodo,
  quickCompleteTodo,
  updateTodoOrder,
  updateTodoStatusAndOrder,
} from '@/actions/todos'
import { createTag, deleteTag } from '@/actions/tags'

const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const OTHER_ID = 'user_other'
const STRANGER_ID = 'user_stranger'
const TODO_ID = 'todo_1'
const TAG_ID = 'tag_1'
const INVITATION_ID = 'inv_1'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function primeBoard(ownerId = OWNER_ID) {
  const board = {
    id: BOARD_ID,
    ownerId,
    name: 'Sprint 42',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
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

function primeTodo({
  status = 'TO_DO',
  assigneeId = null,
}: {
  status?: string
  assigneeId?: string | null
} = {}) {
  prismaMock.todo.findUnique.mockResolvedValue({
    id: TODO_ID,
    boardId: BOARD_ID,
    status,
    assigneeId,
  })
}

/** Every Activity row the actions under test wrote, in call order. */
function emitted() {
  return prismaMock.activity.create.mock.calls.map(
    (call) => (call as unknown[])[0] as { data: Record<string, unknown> }
  )
}

function emittedActions() {
  return emitted().map((entry) => entry.data.action)
}

beforeEach(() => {
  vi.clearAllMocks()

  // Interactive transactions run against the same mocked client — a test can
  // then assert that BOTH the domain write and the Activity write happened.
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )

  prismaMock.todo.findMany.mockResolvedValue([])
  prismaMock.todo.create.mockResolvedValue({
    id: 'todo_new',
    boardId: BOARD_ID,
    assignee: null,
    tags: [],
  })
  prismaMock.todo.delete.mockResolvedValue({ id: TODO_ID })
  prismaMock.todo.update.mockImplementation(
    async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      boardId: BOARD_ID,
      assignee: null,
      tags: [],
      ...data,
    })
  )
  prismaMock.board.create.mockResolvedValue({ id: BOARD_ID, name: 'New board', ownerId: OWNER_ID })
  prismaMock.board.delete.mockResolvedValue({ id: BOARD_ID })
  prismaMock.boardMember.delete.mockResolvedValue({ id: 'bm_x' })
  prismaMock.boardMember.create.mockResolvedValue({ id: 'bm_x' })
  prismaMock.invitation.create.mockResolvedValue({
    id: INVITATION_ID,
    boardId: BOARD_ID,
    email: 'invitee@t.dev',
  })
  prismaMock.invitation.update.mockResolvedValue({ id: INVITATION_ID, status: 'ACCEPTED' })
  prismaMock.invitation.delete.mockResolvedValue({ id: INVITATION_ID })
  prismaMock.tag.create.mockResolvedValue({ id: TAG_ID, boardId: BOARD_ID })
  prismaMock.tag.delete.mockResolvedValue({ id: TAG_ID })
})

describe('Activity taxonomy — board mutations', () => {
  it('renameBoard persists a board renamed entry atomically with the rename', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)

    const result = await renameBoard(BOARD_ID, 'Renamed')

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.board.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BOARD_ID }, data: { name: 'Renamed' } })
    )
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: OWNER_ID,
      action: 'board.renamed',
      resourceType: 'BOARD',
      resourceId: BOARD_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('renameBoard by a non-owner is rejected and emits nothing', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)

    const result = await renameBoard(BOARD_ID, 'Not allowed')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(emittedActions()).toEqual([])
  })

  it('createBoard emits nothing — board creation is outside the taxonomy', async () => {
    signIn(OWNER_ID)

    const result = await createBoard('Fresh board')

    expect(result.success).toBe(true)
    expect(emittedActions()).toEqual([])
  })

  it('deleteBoard emits nothing — its entries cascade away with the board', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)

    const result = await deleteBoard(BOARD_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.board.delete).toHaveBeenCalledWith({ where: { id: BOARD_ID } })
    expect(emittedActions()).toEqual([])
  })

  it('transferOwnership emits nothing — outside the ADR-0002 taxonomy', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await transferOwnership(BOARD_ID, MEMBER_ID)

    expect(result.success).toBe(true)
    expect(emittedActions()).toEqual([])
  })
})

describe('Activity taxonomy — membership mutations', () => {
  it('createInvitation persists a member invited entry against the Invitation', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)
    primeMembership([])
    prismaMock.invitation.findFirst.mockResolvedValue(null)

    const result = await createInvitation(BOARD_ID, 'invitee@t.dev')

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: OWNER_ID,
      action: 'member.invited',
      resourceType: 'INVITATION',
      resourceId: INVITATION_ID,
      ipAddress: '203.0.113.7',
    })
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1)
  })

  it('revokeInvitation emits nothing — revoking is outside the taxonomy', async () => {
    signIn(OWNER_ID)
    prismaMock.invitation.findUniqueOrThrow.mockResolvedValue({
      id: INVITATION_ID,
      boardId: BOARD_ID,
      board: { ownerId: OWNER_ID },
    })

    const result = await revokeInvitation(INVITATION_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.invitation.delete).toHaveBeenCalledWith({ where: { id: INVITATION_ID } })
    expect(emittedActions()).toEqual([])
  })

  it('acceptInvitation persists a member joined entry with the joiner as actor', async () => {
    signIn(MEMBER_ID)
    prismaMock.invitation.findUnique.mockResolvedValue({
      id: INVITATION_ID,
      boardId: BOARD_ID,
      email: `${MEMBER_ID}@t.dev`,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    primeMembership([])

    const result = await acceptInvitation('token')

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.boardMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { boardId: BOARD_ID, userId: MEMBER_ID } })
    )
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: MEMBER_ID,
      action: 'member.joined',
      resourceType: 'USER',
      resourceId: MEMBER_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('removeMember persists a member removed entry naming the removed member', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)
    prismaMock.boardMember.findFirst.mockResolvedValue({
      id: 'bm_other',
      boardId: BOARD_ID,
      userId: OTHER_ID,
      joinedAt: new Date(),
    })

    const result = await removeMember(BOARD_ID, OTHER_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.boardMember.delete).toHaveBeenCalledWith({ where: { id: 'bm_other' } })
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: OWNER_ID,
      action: 'member.removed',
      resourceType: 'USER',
      resourceId: OTHER_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('leaveBoard persists a member left entry with the leaver as actor', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    prismaMock.boardMember.findFirst.mockResolvedValue({
      id: 'bm_mine',
      boardId: BOARD_ID,
      userId: MEMBER_ID,
      joinedAt: new Date(),
    })

    const result = await leaveBoard(BOARD_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: MEMBER_ID,
      action: 'member.left',
      resourceType: 'USER',
      resourceId: MEMBER_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('a non-member cannot emit membership entries (createInvitation is owner-only)', async () => {
    signIn(STRANGER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await createInvitation(BOARD_ID, 'invitee@t.dev')

    expect(result.success).toBe(false)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(emittedActions()).toEqual([])
  })
})

describe('Activity taxonomy — todo mutations', () => {
  it('createTodo persists a todo created entry atomically with the todo', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Write tests' })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: MEMBER_ID,
      action: 'todo.created',
      resourceType: 'TODO',
      resourceId: 'todo_new',
      ipAddress: '203.0.113.7',
    })
  })

  it('deleteTodo persists a todo deleted entry naming the deleted todo', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo()

    const result = await deleteTodo(TODO_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.todo.delete).toHaveBeenCalledWith({ where: { id: TODO_ID } })
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: MEMBER_ID,
      action: 'todo.deleted',
      resourceType: 'TODO',
      resourceId: TODO_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('updateTodo persists a status changed entry when the status moves', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'TO_DO' })

    const result = await updateTodo(TODO_ID, { status: 'IN_PROGRESS' })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emittedActions()).toEqual(['todo.status_changed'])
    expect(emitted()[0].data).toMatchObject({
      boardId: BOARD_ID,
      actorId: MEMBER_ID,
      resourceType: 'TODO',
      resourceId: TODO_ID,
    })
  })

  it('updateTodo persists an assignee changed entry when the assignee moves', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ assigneeId: null })

    const result = await updateTodo(TODO_ID, { assigneeId: OTHER_ID })

    expect(result.success).toBe(true)
    expect(emittedActions()).toEqual(['todo.assignee_changed'])
    expect(emitted()[0].data).toMatchObject({
      actorId: MEMBER_ID,
      resourceType: 'TODO',
      resourceId: TODO_ID,
    })
  })

  it('updateTodo persists both entries when one update moves status and assignee', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'TO_DO', assigneeId: null })

    const result = await updateTodo(TODO_ID, { status: 'DONE', assigneeId: OTHER_ID })

    expect(result.success).toBe(true)
    expect(emittedActions()).toEqual(['todo.status_changed', 'todo.assignee_changed'])
  })

  it('updateTodo persists nothing for title, priority and due-date edits', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'TO_DO', assigneeId: null })

    const result = await updateTodo(TODO_ID, {
      title: 'Retitled',
      priority: 'URGENT',
      dueDate: '2026-03-01T00:00:00.000Z',
      description: 'New description',
    })

    expect(result.success).toBe(true)
    expect(prismaMock.todo.update).toHaveBeenCalled()
    expect(emittedActions()).toEqual([])
  })

  it('quickCompleteTodo persists a status changed entry', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'TO_DO' })

    const result = await quickCompleteTodo(TODO_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emittedActions()).toEqual(['todo.status_changed'])
  })

  it('updateTodoStatusAndOrder persists a status changed entry on a real column change', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'TO_DO' })

    const result = await updateTodoStatusAndOrder(TODO_ID, 'IN_PROGRESS', 'a0V')

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emittedActions()).toEqual(['todo.status_changed'])
  })

  it('updateTodoStatusAndOrder persists nothing when only the order changes (reorder)', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo({ status: 'IN_PROGRESS' })

    const result = await updateTodoStatusAndOrder(TODO_ID, 'IN_PROGRESS', 'a0V')

    expect(result.success).toBe(true)
    expect(prismaMock.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'IN_PROGRESS', order: 'a0V' } })
    )
    expect(emittedActions()).toEqual([])
  })

  it('updateTodoOrder persists nothing — drag reorders are never in the feed', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo()

    const result = await updateTodoOrder(TODO_ID, 'a0V')

    expect(result.success).toBe(true)
    expect(prismaMock.todo.update).toHaveBeenCalled()
    expect(emittedActions()).toEqual([])
  })

  it('a non-member cannot emit todo entries (createTodo is membership-gated)', async () => {
    signIn(STRANGER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])

    const result = await createTodo({ boardId: BOARD_ID, title: 'Should not land' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(emittedActions()).toEqual([])
  })
})

describe('Activity taxonomy — tag mutations', () => {
  it('createTag persists a tag created entry atomically with the tag', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)

    const result = await createTag({ boardId: BOARD_ID, name: 'bug', color: '#FF0000' })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: OWNER_ID,
      action: 'tag.created',
      resourceType: 'TAG',
      resourceId: TAG_ID,
      ipAddress: '203.0.113.7',
    })
  })

  it('deleteTag persists a tag deleted entry naming the deleted tag', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)
    prismaMock.tag.findUnique.mockResolvedValue({ id: TAG_ID, boardId: BOARD_ID })

    const result = await deleteTag(TAG_ID)

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.tag.delete).toHaveBeenCalledWith({ where: { id: TAG_ID } })
    expect(emitted()).toHaveLength(1)
    expect(emitted()[0].data).toEqual({
      boardId: BOARD_ID,
      actorId: OWNER_ID,
      action: 'tag.deleted',
      resourceType: 'TAG',
      resourceId: TAG_ID,
      ipAddress: '203.0.113.7',
    })
  })
})

describe('Activity entries — cache invalidation (two-cache rule)', () => {
  it('invalidates the Activity feed server tag after an emitting mutation', async () => {
    signIn(OWNER_ID)
    primeBoard(OWNER_ID)

    await renameBoard(BOARD_ID, 'Renamed')

    expect(revalidateTagMock).toHaveBeenCalledWith('activity', 'max')
  })

  it('does not invalidate the Activity feed server tag after a silent mutation', async () => {
    signIn(MEMBER_ID)
    primeBoard(OWNER_ID)
    primeMembership([MEMBER_ID])
    primeTodo()

    await updateTodoOrder(TODO_ID, 'a0V')

    expect(revalidateTagMock).not.toHaveBeenCalledWith('activity', 'max')
  })
})
