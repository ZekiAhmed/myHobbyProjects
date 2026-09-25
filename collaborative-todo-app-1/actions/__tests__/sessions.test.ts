/**
 * @fileoverview Server-entrypoint tests for the Account Security tab —
 * Active sessions (ticket 07)
 *
 * CONTRACT UNDER TEST:
 *
 * 1. listActiveSessions returns only the acting user's non-expired Session
 *    rows — other users' rows and expired rows never appear — each with a
 *    human device label (parsed user agent), IP, created-at, expires-at,
 *    and an `isCurrent` flag marking the session making the call
 * 2. revokeSession signs out another of the acting user's sessions; the row
 *    is gone and the list no longer shows it
 * 3. Revoking the current session is rejected (Sign out already exists) and
 *    the session stays active
 * 4. revokeOtherSessions signs out every other session of the acting user
 *    in one call while the current session stays active
 * 5. A session belonging to another user can be neither listed nor revoked —
 *    revoke reports authorization failure and the row survives
 *
 * Data source: Better Auth's own Session store (the prisma `Session` model
 * Better Auth writes through its adapter) — no parallel session store is
 * created (spec req 53). Rows are modeled as an in-memory store at the
 * mocked module boundary so scoping (userId) and preservation (current
 * session) are observable as external behavior, per spec §Testing
 * Decisions: external behavior only, db and session mocked, no real
 * database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

type StoredSession = {
  id: string
  userId: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  session: { findMany: vi.fn(), deleteMany: vi.fn() },
}))
const revalidateTagMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

import { listActiveSessions, revokeSession, revokeOtherSessions } from '@/actions/sessions'

const USER_A = 'user_a'
const USER_B = 'user_b'

const CHROME_WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const FIREFOX_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'

let store: StoredSession[] = []

function signIn(userId: string, sessionId = 'sess_current') {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: sessionId, token: 'tok_current' },
  })
}

function seedSession(
  partial: Partial<StoredSession> & { id: string; userId: string }
): StoredSession {
  const row: StoredSession = {
    ipAddress: '203.0.113.10',
    userAgent: CHROME_WINDOWS_UA,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    ...partial,
  }
  store.push(row)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  store = []

  prismaMock.session.findMany.mockImplementation(
    async ({ where }: { where: { userId: string; expiresAt?: { gt: Date } } }) => {
      const rows = store.filter((s) => {
        if (s.userId !== where.userId) return false
        if (where.expiresAt?.gt && !(s.expiresAt > where.expiresAt.gt)) return false
        return true
      })
      return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
  )
  prismaMock.session.deleteMany.mockImplementation(
    async ({
      where,
    }: {
      where: {
        userId?: string
        id?: string | { not: string }
        expiresAt?: { gt: Date }
      }
    }) => {
      const before = store.length
      store = store.filter((s) => {
        if (where.userId !== undefined && s.userId !== where.userId) return true
        if (typeof where.id === 'string') {
          if (s.id !== where.id) return true
        } else if (where.id?.not !== undefined) {
          if (s.id === where.id.not) return true
        }
        if (where.expiresAt?.gt && !(s.expiresAt > where.expiresAt.gt)) return true
        return false
      })
      return { count: before - store.length }
    }
  )
})

describe('listActiveSessions', () => {
  it("lists only the acting user's active sessions with device label, IP, timestamps, and current flag", async () => {
    signIn(USER_A, 'sess_a_current')
    seedSession({
      id: 'sess_a_current',
      userId: USER_A,
      userAgent: CHROME_WINDOWS_UA,
      ipAddress: '198.51.100.4',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    })
    seedSession({
      id: 'sess_a_phone',
      userId: USER_A,
      userAgent: SAFARI_IOS_UA,
      ipAddress: '198.51.100.9',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    })
    seedSession({
      id: 'sess_a_unknown',
      userId: USER_A,
      userAgent: '',
      ipAddress: '',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    })
    seedSession({
      id: 'sess_a_expired',
      userId: USER_A,
      expiresAt: new Date(Date.now() - 1000),
    })
    seedSession({
      id: 'sess_b',
      userId: USER_B,
      userAgent: FIREFOX_MAC_UA,
      ipAddress: '192.0.2.55',
    })

    const result = await listActiveSessions()

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.map((s) => s.id)).toEqual([
      'sess_a_current',
      'sess_a_phone',
      'sess_a_unknown',
    ])

    const current = result.data[0]
    expect(current).toMatchObject({
      isCurrent: true,
      device: 'Chrome on Windows',
      ip: '198.51.100.4',
      createdAt: store.find((s) => s.id === 'sess_a_current')!.createdAt,
      expiresAt: store.find((s) => s.id === 'sess_a_current')!.expiresAt,
    })
    expect(current).not.toHaveProperty('token')

    expect(result.data[1]).toMatchObject({
      isCurrent: false,
      device: 'Safari on iOS',
      ip: '198.51.100.9',
    })
    expect(result.data[2]).toMatchObject({
      isCurrent: false,
      device: 'Unknown device',
      ip: 'Unknown IP',
    })
  })
})

describe('revokeSession', () => {
  it("revokes another of the acting user's sessions and it disappears from the list", async () => {
    signIn(USER_A, 'sess_a_current')
    seedSession({ id: 'sess_a_current', userId: USER_A })
    seedSession({ id: 'sess_a_other', userId: USER_A, userAgent: FIREFOX_MAC_UA })

    const result = await revokeSession('sess_a_other')

    expect(result.success).toBe(true)
    expect(store.some((s) => s.id === 'sess_a_other')).toBe(false)
    expect(revalidateTagMock).toHaveBeenCalledWith('sessions', 'max')

    const list = await listActiveSessions()
    expect(list.success).toBe(true)
    if (!list.success) return
    expect(list.data.map((s) => s.id)).toEqual(['sess_a_current'])
  })

  it('rejects revoking the current session and the session stays active', async () => {
    signIn(USER_A, 'sess_a_current')
    seedSession({ id: 'sess_a_current', userId: USER_A })
    seedSession({ id: 'sess_a_other', userId: USER_A })

    const result = await revokeSession('sess_a_current')

    expect(result).toEqual({
      success: false,
      error: {
        type: 'authorization',
        message: 'You cannot revoke your current session',
      },
    })
    expect(store.some((s) => s.id === 'sess_a_current')).toBe(true)

    const list = await listActiveSessions()
    expect(list.success).toBe(true)
    if (!list.success) return
    expect(list.data.map((s) => s.id)).toContain('sess_a_current')
  })

  it('rejects revoking a session that belongs to another user, which survives', async () => {
    signIn(USER_A, 'sess_a_current')
    seedSession({ id: 'sess_a_current', userId: USER_A })
    seedSession({ id: 'sess_b_other', userId: USER_B })

    const result = await revokeSession('sess_b_other')

    expect(result).toEqual({
      success: false,
      error: { type: 'authorization', message: 'Session not found' },
    })
    expect(store.some((s) => s.id === 'sess_b_other')).toBe(true)
  })
})

describe('revokeOtherSessions', () => {
  it('revokes every other session in one call while the current session stays active', async () => {
    signIn(USER_A, 'sess_a_current')
    seedSession({ id: 'sess_a_current', userId: USER_A })
    seedSession({ id: 'sess_a_other_1', userId: USER_A })
    seedSession({ id: 'sess_a_other_2', userId: USER_A, userAgent: SAFARI_IOS_UA })
    seedSession({ id: 'sess_b', userId: USER_B })

    const result = await revokeOtherSessions()

    expect(result).toEqual({ success: true, data: { count: 2 } })
    expect(store.map((s) => s.id).sort()).toEqual(['sess_a_current', 'sess_b'])
    expect(revalidateTagMock).toHaveBeenCalledWith('sessions', 'max')

    const list = await listActiveSessions()
    expect(list.success).toBe(true)
    if (!list.success) return
    expect(list.data.map((s) => s.id)).toEqual(['sess_a_current'])
    expect(list.data[0].isCurrent).toBe(true)
  })
})
