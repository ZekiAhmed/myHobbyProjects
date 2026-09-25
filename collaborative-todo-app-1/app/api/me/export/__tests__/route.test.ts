/**
 * @fileoverview Server-entrypoint tests for the Data export (ticket 08)
 *
 * CONTRACT UNDER TEST (GET /api/me/export):
 * 1. Every documented section is present for a seeded user — profile, account
 *    metadata, session metadata, owned boards + memberships, assigned todos +
 *    todos on owned boards, authored Comments, addressed Notifications (with
 *    read state), actor-scoped Activity entries, Invitations to their email
 * 2. Password hashes, session tokens, and invite tokens are absent from the
 *    serialized response body — asserted on what the client downloads, not on
 *    which columns a query happened to select
 * 3. An unauthenticated request is rejected (401) with no export payload
 * 4. Another user's private rows never appear in this user's export, and
 *    cross-board visibility is limited to rows the exporter owns or is assigned
 * 5. The response is a single synchronous JSON file attachment
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: app/api/notifications/__tests__/route.test.ts).
 * The db mock is a small faithful store: `findMany` applies the query's `where`
 * the way the database would, so a query that drops its scope returns every
 * row and the leakage assertions fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type Row = Record<string, unknown>

type ExportPayload = {
  exportedAt: string
  profile: Row
  accounts: Row[]
  sessions: Row[]
  boards: { owned: Row[]; memberships: Row[] }
  todos: { assigned: Row[]; onOwnedBoards: Row[] }
  comments: Row[]
  notifications: Row[]
  activity: Row[]
  invitations: Row[]
}

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  account: { findMany: vi.fn() },
  session: { findMany: vi.fn() },
  board: { findMany: vi.fn() },
  boardMember: { findMany: vi.fn() },
  todo: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
  notification: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  invitation: { findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getOptionalSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as exportData } from '@/app/api/me/export/route'

const USER_A = 'user_a'
const USER_B = 'user_b'

const PASSWORD_HASH = 'bcrypt$A_password_hash_secret'
const SESSION_TOKEN = 'a_session_token_secret'
const INVITE_TOKEN = 'a_invite_token_secret'
const MIXED_CASE_INVITE_TOKEN = 'mixed_case_invite_token_secret'

const OTHER_PASSWORD_HASH = 'bcrypt$B_password_hash_secret'
const OTHER_SESSION_TOKEN = 'b_session_token_secret'
const OTHER_INVITE_TOKEN = 'b_invite_token_secret'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date(Date.UTC(2026, 8, 1, 12))
const ISO_NOW = NOW.toISOString()
const ISO_EXPIRES = new Date(NOW.getTime() + 7 * DAY).toISOString()
const ISO_INVITE_EXPIRES = new Date(NOW.getTime() + 2 * DAY).toISOString()

let store: Record<string, Row[]> = {}

const RELATIONS: Record<string, (row: Row) => Row | undefined> = {
  board: (row) => store.boards.find((b) => b.id === row.boardId),
  todo: (row) => store.todos.find((t) => t.id === row.todoId),
}

function matches(row: Row, where?: Row): boolean {
  if (!where) return true
  return Object.entries(where).every(([key, value]) => {
    const resolve = RELATIONS[key]
    if (resolve) return matches(resolve(row) ?? {}, value as Row)
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      const filter = value as { equals?: unknown; mode?: string }
      if ('equals' in filter) {
        const actual = String(row[key] ?? '')
        const expected = String(filter.equals ?? '')
        return filter.mode === 'insensitive'
          ? actual.toLowerCase() === expected.toLowerCase()
          : actual === expected
      }
      return matches(row[key] as Row, value as Row)
    }
    return row[key] === value
  })
}

function withIncludes(row: Row, include?: Record<string, boolean>): Row {
  if (!include) return row
  const withRelations = { ...row }
  for (const key of Object.keys(include)) {
    const resolve = RELATIONS[key]
    if (resolve) withRelations[key] = resolve(row) ?? null
  }
  return withRelations
}

function mockTable(name: string) {
  return async (args: { where?: Row; include?: Record<string, boolean> } = {}) =>
    (store[name] ?? [])
      .filter((row) => matches(row, args.where))
      .map((row) => withIncludes(row, args.include))
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: userId === USER_A ? 'ada@t.dev' : 'bob@t.dev' },
    session: { id: 'sess_current' },
  })
}

function seed() {
  store = {
    users: [
      {
        id: USER_A,
        name: 'Ada',
        email: 'ada@t.dev',
        emailVerified: true,
        image: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: USER_B,
        name: 'Bob',
        email: 'bob@t.dev',
        emailVerified: false,
        image: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    accounts: [
      {
        id: 'acc_a',
        userId: USER_A,
        accountId: 'ada@t.dev',
        providerId: 'credential',
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        idToken: null,
        password: PASSWORD_HASH,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'acc_b',
        userId: USER_B,
        accountId: 'bob@t.dev',
        providerId: 'credential',
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
        idToken: null,
        password: OTHER_PASSWORD_HASH,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    sessions: [
      {
        id: 'sess_a',
        userId: USER_A,
        token: SESSION_TOKEN,
        ipAddress: '198.51.100.4',
        userAgent: 'Chrome on Windows',
        createdAt: NOW,
        updatedAt: NOW,
        expiresAt: new Date(NOW.getTime() + 7 * DAY),
      },
      {
        id: 'sess_b',
        userId: USER_B,
        token: OTHER_SESSION_TOKEN,
        ipAddress: '203.0.113.99',
        userAgent: 'Firefox on macOS',
        createdAt: NOW,
        updatedAt: NOW,
        expiresAt: new Date(NOW.getTime() + 7 * DAY),
      },
    ],
    boards: [
      { id: 'board_a', name: 'Ada board', ownerId: USER_A, createdAt: NOW, updatedAt: NOW },
      { id: 'board_b', name: 'Bob board', ownerId: USER_B, createdAt: NOW, updatedAt: NOW },
    ],
    memberships: [
      { id: 'mem_a_on_b', boardId: 'board_b', userId: USER_A, joinedAt: NOW },
      { id: 'mem_b_on_a', boardId: 'board_a', userId: USER_B, joinedAt: NOW },
    ],
    todos: [
      {
        id: 'todo_owned_assigned',
        boardId: 'board_a',
        title: 'Owned and assigned',
        description: null,
        status: 'TO_DO',
        priority: 'MEDIUM',
        dueDate: null,
        order: 'a0',
        assigneeId: USER_A,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'todo_owned_other',
        boardId: 'board_a',
        title: 'Owned, assigned to Bob',
        description: null,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: null,
        order: 'a1',
        assigneeId: USER_B,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'todo_elsewhere_assigned',
        boardId: 'board_b',
        title: 'On Bob board, assigned to Ada',
        description: null,
        status: 'DONE',
        priority: 'LOW',
        dueDate: null,
        order: 'a2',
        assigneeId: USER_A,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'todo_elsewhere_other',
        boardId: 'board_b',
        title: 'On Bob board, Bob work',
        description: null,
        status: 'TO_DO',
        priority: 'MEDIUM',
        dueDate: null,
        order: 'a3',
        assigneeId: USER_B,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    comments: [
      {
        id: 'comment_a_elsewhere',
        body: 'Ada note on a board she does not own',
        todoId: 'todo_elsewhere_assigned',
        authorId: USER_A,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'comment_b_on_a',
        body: "Bob's private note on Ada's board",
        todoId: 'todo_owned_assigned',
        authorId: USER_B,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    notifications: [
      {
        id: 'notif_a_read',
        userId: USER_A,
        actorId: USER_B,
        type: 'ASSIGNED',
        boardId: 'board_b',
        todoId: 'todo_elsewhere_assigned',
        readAt: NOW,
        createdAt: NOW,
      },
      {
        id: 'notif_a_unread',
        userId: USER_A,
        actorId: USER_B,
        type: 'COMMENTED',
        boardId: 'board_b',
        todoId: 'todo_elsewhere_assigned',
        readAt: null,
        createdAt: NOW,
      },
      {
        id: 'notif_b',
        userId: USER_B,
        actorId: USER_A,
        type: 'ASSIGNED',
        boardId: 'board_a',
        todoId: 'todo_owned_other',
        readAt: null,
        createdAt: NOW,
      },
    ],
    activity: [
      {
        id: 'activity_a',
        boardId: 'board_b',
        actorId: USER_A,
        action: 'comment.created',
        resourceType: 'comment',
        resourceId: 'comment_a_elsewhere',
        ipAddress: '198.51.100.4',
        createdAt: NOW,
      },
      {
        id: 'activity_b',
        boardId: 'board_a',
        actorId: USER_B,
        action: 'todo.status_changed',
        resourceType: 'todo',
        resourceId: 'todo_owned_other',
        ipAddress: '203.0.113.99',
        createdAt: NOW,
      },
    ],
    invitations: [
      {
        id: 'invite_a',
        boardId: 'board_b',
        email: 'ada@t.dev',
        token: INVITE_TOKEN,
        status: 'PENDING',
        expiresAt: new Date(NOW.getTime() + 2 * DAY),
        createdAt: NOW,
      },
      {
        id: 'invite_a_mixed_case',
        boardId: 'board_a',
        email: 'Ada@t.dev',
        token: MIXED_CASE_INVITE_TOKEN,
        status: 'ACCEPTED',
        expiresAt: new Date(NOW.getTime() + 2 * DAY),
        createdAt: NOW,
      },
      {
        id: 'invite_b',
        boardId: 'board_a',
        email: 'bob@t.dev',
        token: OTHER_INVITE_TOKEN,
        status: 'PENDING',
        expiresAt: new Date(NOW.getTime() + 2 * DAY),
        createdAt: NOW,
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  seed()
  signIn(USER_A)

  prismaMock.user.findUnique.mockImplementation(
    async ({ where }: { where: Row }) => store.users.find((u) => matches(u, where)) ?? null
  )
  prismaMock.account.findMany.mockImplementation(mockTable('accounts'))
  prismaMock.session.findMany.mockImplementation(mockTable('sessions'))
  prismaMock.board.findMany.mockImplementation(mockTable('boards'))
  prismaMock.boardMember.findMany.mockImplementation(mockTable('memberships'))
  prismaMock.todo.findMany.mockImplementation(mockTable('todos'))
  prismaMock.comment.findMany.mockImplementation(mockTable('comments'))
  prismaMock.notification.findMany.mockImplementation(mockTable('notifications'))
  prismaMock.activity.findMany.mockImplementation(mockTable('activity'))
  prismaMock.invitation.findMany.mockImplementation(mockTable('invitations'))
})

async function runExport() {
  const res = await exportData()
  const body = await res.text()
  return { res, body, payload: JSON.parse(body) as ExportPayload }
}

function ids(rows: Row[] | undefined): string[] {
  return (rows ?? []).map((row) => row.id as string).sort()
}

describe('GET /api/me/export — documented sections', () => {
  it('returns every documented section for the seeded user', async () => {
    const { res, payload } = await runExport()

    expect(res.status).toBe(200)
    expect(Object.keys(payload).sort()).toEqual(
      [
        'accounts',
        'activity',
        'boards',
        'comments',
        'exportedAt',
        'invitations',
        'notifications',
        'profile',
        'sessions',
        'todos',
      ].sort()
    )

    expect(payload.profile).toMatchObject({
      id: USER_A,
      name: 'Ada',
      email: 'ada@t.dev',
      emailVerified: true,
      createdAt: ISO_NOW,
      updatedAt: ISO_NOW,
    })
    expect(typeof payload.exportedAt).toBe('string')

    expect(ids(payload.accounts)).toEqual(['acc_a'])
    expect(payload.accounts[0]).toMatchObject({
      providerId: 'credential',
      accountId: 'ada@t.dev',
      createdAt: ISO_NOW,
    })
  })

  it('includes session metadata and boards (owned + memberships)', async () => {
    const { payload } = await runExport()

    expect(ids(payload.sessions)).toEqual(['sess_a'])
    expect(payload.sessions[0]).toMatchObject({
      ipAddress: '198.51.100.4',
      userAgent: 'Chrome on Windows',
      createdAt: ISO_NOW,
      expiresAt: ISO_EXPIRES,
    })

    expect(ids(payload.boards.owned)).toEqual(['board_a'])
    expect(payload.boards.owned[0]).toMatchObject({
      name: 'Ada board',
      ownerId: USER_A,
      createdAt: ISO_NOW,
    })

    expect(ids(payload.boards.memberships)).toEqual(['mem_a_on_b'])
    expect(payload.boards.memberships[0]).toMatchObject({
      boardId: 'board_b',
      userId: USER_A,
      joinedAt: ISO_NOW,
      boardName: 'Bob board',
    })
  })

  it('includes assigned todos and todos on owned boards', async () => {
    const { payload } = await runExport()

    expect(ids(payload.todos.assigned)).toEqual([
      'todo_elsewhere_assigned',
      'todo_owned_assigned',
    ])
    expect(ids(payload.todos.onOwnedBoards)).toEqual([
      'todo_owned_assigned',
      'todo_owned_other',
    ])
    expect(payload.todos.assigned[0]).toMatchObject({
      title: 'Owned and assigned',
      assigneeId: USER_A,
      status: 'TO_DO',
      priority: 'MEDIUM',
      boardId: 'board_a',
      dueDate: null,
      order: 'a0',
    })
  })

  it('includes authored Comments, addressed Notifications with read state, actor Activity, and Invitations', async () => {
    const { payload } = await runExport()

    expect(ids(payload.comments)).toEqual(['comment_a_elsewhere'])
    expect(payload.comments[0]).toMatchObject({
      body: 'Ada note on a board she does not own',
      todoId: 'todo_elsewhere_assigned',
      boardId: 'board_b',
      authorId: USER_A,
      createdAt: ISO_NOW,
    })

    expect(ids(payload.notifications)).toEqual(['notif_a_read', 'notif_a_unread'])
    const read = payload.notifications.find((n) => n.id === 'notif_a_read')
    const unread = payload.notifications.find((n) => n.id === 'notif_a_unread')
    expect(read).toMatchObject({ readAt: ISO_NOW, type: 'ASSIGNED' })
    expect(unread).toMatchObject({ readAt: null, type: 'COMMENTED' })

    expect(ids(payload.activity)).toEqual(['activity_a'])
    expect(payload.activity[0]).toMatchObject({
      boardId: 'board_b',
      action: 'comment.created',
      resourceType: 'comment',
      resourceId: 'comment_a_elsewhere',
      ipAddress: '198.51.100.4',
    })

    expect(ids(payload.invitations)).toEqual(['invite_a', 'invite_a_mixed_case'])
    expect(payload.invitations[0]).toMatchObject({
      email: 'ada@t.dev',
      status: 'PENDING',
      boardId: 'board_b',
      expiresAt: ISO_INVITE_EXPIRES,
    })
    // an invite typed with different casing by the inviting Owner still
    // counts as addressed to this user
    expect(payload.invitations[1]).toMatchObject({
      email: 'Ada@t.dev',
      status: 'ACCEPTED',
      boardId: 'board_a',
    })
  })
})

describe('GET /api/me/export — redaction', () => {
  it('omits password hashes, session tokens, and invite tokens from the downloaded payload', async () => {
    const { body } = await runExport()

    expect(body).not.toContain(PASSWORD_HASH)
    expect(body).not.toContain(SESSION_TOKEN)
    expect(body).not.toContain(INVITE_TOKEN)
    expect(body).not.toContain(MIXED_CASE_INVITE_TOKEN)
  })

  it('omits the secret fields themselves, not just their values', async () => {
    const { body } = await runExport()

    expect(body).not.toContain('"password"')
    expect(body).not.toContain('"token"')
    expect(body).not.toContain('"accessToken"')
    expect(body).not.toContain('"refreshToken"')
    expect(body).not.toContain('"idToken"')
  })

  it('keeps OAuth account metadata (provider, scope, token expiry) as personal data', async () => {
    const { payload } = await runExport()

    expect(payload.accounts[0]).toMatchObject({
      providerId: 'credential',
      scope: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
    })
  })
})

describe('GET /api/me/export — authentication', () => {
  it('rejects an unauthenticated request with no export payload', async () => {
    sessionMock.getSession.mockResolvedValue(null)

    const res = await exportData()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
  })
})

describe('GET /api/me/export — scoping', () => {
  it("never includes another user's private rows", async () => {
    const { body, payload } = await runExport()

    expect(body).not.toContain(OTHER_PASSWORD_HASH)
    expect(body).not.toContain(OTHER_SESSION_TOKEN)
    expect(body).not.toContain(OTHER_INVITE_TOKEN)
    expect(body).not.toContain("Bob's private note")
    expect(body).not.toContain('bob@t.dev')

    expect(ids(payload.accounts)).not.toContain('acc_b')
    expect(ids(payload.sessions)).not.toContain('sess_b')
    expect(ids(payload.notifications)).not.toContain('notif_b')
    expect(ids(payload.activity)).not.toContain('activity_b')
    expect(ids(payload.invitations)).not.toContain('invite_b')
  })

  it("limits cross-board visibility to boards the exporter owns or rows they're assigned", async () => {
    const { payload } = await runExport()

    // membership of Bob's board does not grant his Todos or his Comments
    expect(ids(payload.todos.onOwnedBoards)).not.toContain('todo_elsewhere_other')
    expect(ids(payload.todos.assigned)).not.toContain('todo_elsewhere_other')
    expect(ids(payload.comments)).not.toContain('comment_b_on_a')

    // ...but the exporter's own work and writing on that board still travel with them
    expect(ids(payload.todos.assigned)).toContain('todo_elsewhere_assigned')
    expect(ids(payload.comments)).toContain('comment_a_elsewhere')
    expect(ids(payload.activity)).toContain('activity_a')
  })

  it('scopes every read to the acting user', async () => {
    signIn(USER_B)

    const { payload } = await runExport()

    expect(payload.profile).toMatchObject({ id: USER_B, email: 'bob@t.dev' })
    expect(ids(payload.sessions)).toEqual(['sess_b'])
    expect(ids(payload.invitations)).toEqual(['invite_b'])
    expect(ids(payload.comments)).toEqual(['comment_b_on_a'])
    expect(ids(payload.todos.onOwnedBoards)).toEqual([
      'todo_elsewhere_assigned',
      'todo_elsewhere_other',
    ])
    expect(ids(payload.todos.assigned)).toEqual([
      'todo_elsewhere_other',
      'todo_owned_other',
    ])
  })
})

describe('GET /api/me/export — response format', () => {
  it('answers with a single synchronous JSON file attachment', async () => {
    const { res, body } = await runExport()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('content-disposition')).toMatch(
      /^attachment; filename="data-export-\d{4}-\d{2}-\d{2}\.json"$/
    )
    expect(JSON.parse(body)).toBeTypeOf('object')
  })
})
