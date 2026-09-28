/**
 * @fileoverview Server-entrypoint tests for the Notification dropdown read
 *
 * CONTRACT UNDER TEST (GET /api/notifications):
 * 1. The page and the unread count are scoped to the acting user only
 * 2. Unread-count contract: count = the acting user's rows with readAt null
 * 3. Page returns Notifications newest → oldest, 20 per page, with a
 *    nextCursor continuation (never a full-list fetch)
 * 4. Unknown/mismatched `before` cursor → 400, no rows read
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: app/api/todos/[id]/__tests__/route.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  notification: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getNotifications } from '@/app/api/notifications/route'

const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const OTHER_ID = 'user_other'

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function notificationRow(id: string, minutesAfterEpoch: number) {
  return {
    id,
    userId: MEMBER_ID,
    actorId: OWNER_ID,
    type: 'ASSIGNED',
    boardId: 'board_1',
    readAt: null,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutesAfterEpoch)),
    actor: { id: OWNER_ID, name: 'Owner', image: null },
    todo: { id: `todo_${id}`, title: `Task ${id}` },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.notification.count.mockResolvedValue(0)
  prismaMock.notification.findMany.mockResolvedValue([])
})

describe('GET /api/notifications — scoping', () => {
  it('reads the page only for the acting user', async () => {
    signIn(MEMBER_ID)

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))

    expect(res.status).toBe(200)
    expect(prismaMock.notification.findMany).toHaveBeenCalledTimes(1)
    const { where } = prismaMock.notification.findMany.mock.calls[0][0]
    expect(where.userId).toBe(MEMBER_ID)
  })

  it('unread-count contract: counts only the acting user\'s null-readAt rows', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.count.mockResolvedValue(4)

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))
    const payload = await res.json()

    expect(payload.unreadCount).toBe(4)
    expect(prismaMock.notification.count).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: MEMBER_ID, readAt: null },
    })
  })

  it('scopes the count to the signed-in user, never the board or a bystander', async () => {
    signIn(OTHER_ID)
    prismaMock.notification.count.mockResolvedValue(9)

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))
    const payload = await res.json()

    expect(payload.unreadCount).toBe(9)
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: OTHER_ID, readAt: null },
    })
  })
})

describe('GET /api/notifications — page order and boundary', () => {
  it('returns the page newest → oldest with rows shaped for the dropdown', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.findMany.mockResolvedValue([
      notificationRow('n3', 2),
      notificationRow('n2', 1),
      notificationRow('n1', 0),
    ])
    prismaMock.notification.count.mockResolvedValue(3)

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.notifications.map((n: { id: string }) => n.id)).toEqual(['n3', 'n2', 'n1'])
    expect(payload.notifications[0]).toMatchObject({
      type: 'ASSIGNED',
      boardId: 'board_1',
      actor: { id: OWNER_ID, name: 'Owner' },
      todo: { title: 'Task n3' },
    })
    expect(payload.nextCursor).toBeNull()
  })

  it('carries a payment decision row through with its null board and todo refs (issue 08)', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: 'n_payment',
        userId: MEMBER_ID,
        actorId: OWNER_ID,
        type: 'PAYMENT_REJECTED',
        // a decision belongs to no board and no todo (spec story 51)
        boardId: null,
        readAt: null,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 5)),
        actor: { id: OWNER_ID, name: 'Owner', image: null },
        todo: null,
      },
    ])
    prismaMock.notification.count.mockResolvedValue(1)

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))
    const payload = await res.json()

    expect(payload.notifications[0]).toMatchObject({
      type: 'PAYMENT_REJECTED',
      boardId: null,
      todo: null,
      actor: { id: OWNER_ID, name: 'Owner' },
    })
  })

  it('returns at most 20 with a nextCursor when older pages exist', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => notificationRow(`n${21 - i}`, 21 - i))
    )

    const res = await getNotifications(makeRequest('http://localhost/api/notifications'))

    const payload = await res.json()
    expect(payload.notifications).toHaveLength(20)
    expect(payload.notifications[0].id).toBe('n21')
    expect(payload.notifications[19].id).toBe('n2')
    expect(payload.nextCursor).toBe('n2')
  })

  it('pages backward from the before cursor', async () => {
    signIn(MEMBER_ID)
    const cursorCreatedAt = new Date(Date.UTC(2026, 0, 1, 0, 21))
    prismaMock.notification.findUnique.mockResolvedValue({
      id: 'n21',
      userId: MEMBER_ID,
      createdAt: cursorCreatedAt,
    })
    // only rows older than the cursor come back from the db (21 → 20 + more)
    prismaMock.notification.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => notificationRow(`n${21 - i}`, 21 - i))
    )

    const res = await getNotifications(
      makeRequest('http://localhost/api/notifications?before=n21')
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.notifications).toHaveLength(20)
    expect(payload.notifications[0].id).toBe('n21')
    expect(payload.nextCursor).toBe('n2')

    // continuation asks for rows strictly older than the cursor, for this user
    const { where } = prismaMock.notification.findMany.mock.calls[0][0]
    expect(where.userId).toBe(MEMBER_ID)
    expect(where.OR).toEqual([
      { createdAt: { lt: cursorCreatedAt } },
      { createdAt: cursorCreatedAt, id: { lt: 'n21' } },
    ])
  })

  it('returns 400 for an unknown before cursor', async () => {
    signIn(MEMBER_ID)
    prismaMock.notification.findUnique.mockResolvedValue(null)

    const res = await getNotifications(
      makeRequest('http://localhost/api/notifications?before=missing')
    )

    expect(res.status).toBe(400)
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled()
  })

  it('returns 400 for a cursor that belongs to a different user', async () => {
    signIn(MEMBER_ID)
    // the fake db holds the cursor row — but addressed to someone else, so a
    // lookup scoped to the acting user must not resolve it
    prismaMock.notification.findUnique.mockImplementation(
      async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === 'someone_elses_row' && where.userId === MEMBER_ID
          ? null
          : { id: where.id, userId: where.userId, createdAt: new Date() }
    )

    const res = await getNotifications(
      makeRequest('http://localhost/api/notifications?before=someone_elses_row')
    )

    expect(res.status).toBe(400)
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled()
  })
})
