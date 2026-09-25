/**
 * @fileoverview Server-entrypoint tests for the Activity feed read
 *
 * CONTRACT UNDER TEST (GET /api/boards/[id]/activity):
 * 1. Non-members get 403 even with a valid board id (same posture as board detail)
 * 2. Page returns entries newest → oldest (the feed's display order)
 * 3. Page boundary: 20 per page with a `nextCursor` continuation contract for "Load older"
 * 4. The actor is resolved inline — null when the account was erased, which is
 *    the feed's "Former member" input
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: app/api/todos/[id]/comments/__tests__/route.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: { findUnique: vi.fn() },
  boardMember: { findFirst: vi.fn() },
  activity: { findUnique: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getActivity } from '@/app/api/boards/[id]/activity/route'

const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const STRANGER_ID = 'user_stranger'

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function boardParams() {
  return { params: Promise.resolve({ id: BOARD_ID }) }
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function primeAccess(ownerId: string, memberUserIds: string[]) {
  prismaMock.board.findUnique.mockResolvedValue({ id: BOARD_ID, ownerId })
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { boardId: string; userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: where.boardId, userId: where.userId, joinedAt: new Date() }
        : null
  )
}

function entryRow(
  id: string,
  minutesAfterEpoch: number,
  actor: { id: string; name: string; image: string | null } | null = {
    id: MEMBER_ID,
    name: 'Member',
    image: null,
  }
) {
  return {
    id,
    action: 'todo.created',
    resourceType: 'TODO',
    resourceId: `todo_${id}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutesAfterEpoch)),
    actor,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/boards/[id]/activity — membership', () => {
  it('rejects a non-member even with a valid board id', async () => {
    signIn(STRANGER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    expect(res.status).toBe(403)
    expect(prismaMock.activity.findMany).not.toHaveBeenCalled()
  })

  it('rejects with 404 when the board does not exist', async () => {
    signIn(MEMBER_ID)
    prismaMock.board.findUnique.mockResolvedValue(null)

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    expect(res.status).toBe(404)
    expect(prismaMock.activity.findMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/boards/[id]/activity — page order', () => {
  it('returns a page ordered newest → oldest (no reversal)', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // the order the route asks Prisma for (desc window fetch)
    prismaMock.activity.findMany.mockResolvedValue([
      entryRow('a3', 2),
      entryRow('a2', 1),
      entryRow('a1', 0),
    ])

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.activities.map((a: { id: string }) => a.id)).toEqual(['a3', 'a2', 'a1'])
    expect(payload.activities[0]).toMatchObject({
      action: 'todo.created',
      resourceType: 'TODO',
      actor: { id: MEMBER_ID, name: 'Member' },
    })
  })

  it('never returns the compliance IP address to board members', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.activity.findMany.mockResolvedValue([entryRow('a1', 0)])

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    const payload = await res.json()
    expect(payload.activities[0]).not.toHaveProperty('ipAddress')
    expect(payload.activities[0]).not.toHaveProperty('actorId')
  })

  it('passes a null actor through — the feed renders it as "Former member"', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.activity.findMany.mockResolvedValue([entryRow('a1', 0, null)])

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    const payload = await res.json()
    expect(payload.activities[0].actor).toBeNull()
  })
})

describe('GET /api/boards/[id]/activity — boundary and continuation', () => {
  it('returns at most 20 entries with a nextCursor when older pages exist', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // 21 rows newest → oldest: a21 … a1
    prismaMock.activity.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => entryRow(`a${21 - i}`, 21 - i))
    )

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.activities).toHaveLength(20)
    expect(payload.activities[0].id).toBe('a21')
    expect(payload.activities[19].id).toBe('a2')
    expect(payload.nextCursor).toBe('a2')
  })

  it('returns nextCursor null when the page reaches the start of the log', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.activity.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => entryRow(`a${20 - i}`, 20 - i))
    )

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity`),
      boardParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.activities).toHaveLength(20)
    expect(payload.activities[19].id).toBe('a1')
    expect(payload.nextCursor).toBeNull()
  })

  it('pages backward from the before cursor', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.activity.findUnique.mockResolvedValue({
      id: 'a41',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 41)),
    })
    // only entries older than the cursor come back from the db
    prismaMock.activity.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => entryRow(`a${40 - i}`, 40 - i))
    )

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity?before=a41`),
      boardParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.activities).toHaveLength(20)
    expect(payload.activities[0].id).toBe('a40')
    expect(payload.activities[19].id).toBe('a21')
    expect(payload.nextCursor).toBe('a21')
  })

  it('returns 400 for an unknown before cursor', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.activity.findUnique.mockResolvedValue(null)

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity?before=missing`),
      boardParams()
    )

    expect(res.status).toBe(400)
    expect(prismaMock.activity.findMany).not.toHaveBeenCalled()
  })

  it('returns 400 for a cursor that belongs to a different board', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // the fake db holds the cursor row — but under a different board, so a
    // lookup scoped to this board must not resolve it
    prismaMock.activity.findUnique.mockImplementation(
      async ({ where }: { where: { id: string; boardId?: string } }) => {
        if (where.id !== 'foreign_cursor') return null
        const row = { ...entryRow('foreign_cursor', 5), boardId: 'board_other' }
        if (where.boardId !== undefined && where.boardId !== row.boardId) return null
        return row
      }
    )
    prismaMock.activity.findMany.mockResolvedValue([])

    const res = await getActivity(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/activity?before=foreign_cursor`),
      boardParams()
    )

    expect(res.status).toBe(400)
    expect(prismaMock.activity.findMany).not.toHaveBeenCalled()
  })
})
