/**
 * @fileoverview Feedback loop for board API 403 while page returns 200
 *
 * SYMPTOM (from dev logs):
 *   GET /boards/[id]           → 200 (page only checks session)
 *   GET /api/boards/[id]       → 403
 *   GET /api/boards/[id]/todos → 403
 * with a valid session and an existing board.
 *
 * CONTRACT UNDER TEST:
 * 1. Board owner gets 200 from both APIs
 * 2. Board member gets 200 from both APIs
 * 3. Stranger gets 403 from both APIs
 * 4. Missing board → 404 (not 403)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: { findUnique: vi.fn() },
  boardMember: { findFirst: vi.fn() },
  todo: { findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getBoard } from '@/app/api/boards/[id]/route'
import { GET as getTodos } from '@/app/api/boards/[id]/todos/route'

const BOARD_ID = 'cmu1xspoa0000g4tu9a92yo8d'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const STRANGER_ID = 'user_stranger'

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function boardParams() {
  return { params: Promise.resolve({ id: BOARD_ID }) }
}

function boardRow(ownerId: string, memberUserIds: string[] = []) {
  return {
    id: BOARD_ID,
    name: 'Test Board',
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { id: ownerId, name: 'Owner', email: 'o@t.dev', image: null },
    members: memberUserIds.map((userId, i) => ({
      id: `bm_${i}`,
      boardId: BOARD_ID,
      userId,
      joinedAt: new Date(),
      user: { id: userId, name: 'M', email: `${userId}@t.dev`, image: null },
    })),
    tags: [],
  }
}

function primeHappyPath(sessionUserId: string, ownerId: string, memberUserIds: string[]) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: sessionUserId, email: `${sessionUserId}@t.dev` },
    session: { id: 's1' },
  })
  prismaMock.board.findUnique.mockImplementation(
    async ({ select }: { select?: unknown }) => {
      if (select) return { ownerId } // todos route: select ownerId only
      return boardRow(ownerId, memberUserIds)
    }
  )
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: BOARD_ID, userId: where.userId, joinedAt: new Date() }
        : null
  )
  prismaMock.todo.findMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/boards/[id] — owner', () => {
  it('returns 200 for the board owner', async () => {
    primeHappyPath(OWNER_ID, OWNER_ID, [])
    const res = await getBoard(makeRequest(`http://localhost/api/boards/${BOARD_ID}`), boardParams())
    expect(res.status).toBe(200)
  })
})

describe('GET /api/boards/[id]/todos — owner', () => {
  it('returns 200 for the board owner', async () => {
    primeHappyPath(OWNER_ID, OWNER_ID, [])
    const res = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('GET /api/boards/[id] — member', () => {
  it('returns 200 for a board member', async () => {
    primeHappyPath(MEMBER_ID, OWNER_ID, [MEMBER_ID])
    const res = await getBoard(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}`),
      boardParams()
    )
    expect(res.status).toBe(200)
  })
})

describe('GET /api/boards/[id]/todos — member', () => {
  it('returns 200 for a board member', async () => {
    primeHappyPath(MEMBER_ID, OWNER_ID, [MEMBER_ID])
    const res = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(res.status).toBe(200)
  })
})

describe('GET /api/boards/[id] — stranger', () => {
  it('returns 403 for a non-member', async () => {
    primeHappyPath(STRANGER_ID, OWNER_ID, [MEMBER_ID])
    const res = await getBoard(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}`),
      boardParams()
    )
    expect(res.status).toBe(403)
  })
})

describe('GET /api/boards/[id]/todos — stranger', () => {
  it('returns 403 for a non-member', async () => {
    primeHappyPath(STRANGER_ID, OWNER_ID, [MEMBER_ID])
    const res = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(res.status).toBe(403)
  })
})

describe('missing board', () => {
  it('todos returns 404 when board does not exist', async () => {
    sessionMock.getSession.mockResolvedValue({
      user: { id: OWNER_ID, email: 'o@t.dev' },
      session: { id: 's1' },
    })
    prismaMock.board.findUnique.mockResolvedValue(null)
    const res = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(res.status).toBe(404)
  })
})

/**
 * Page/API authz consistency — the exact log symptom.
 * The board page only calls getRequiredSession(); if that is enough for 200,
 * the APIs must not 403 the same principal for the same board when the DB
 * says they are owner/member. These cases pin the handler contract that
 * was violated in production logs (session OK + board exists + still 403).
 */
describe('log symptom: session valid, board exists — APIs must not 403 an authorized user', () => {
  it('owner with valid session: both endpoints 200 (log showed 403)', async () => {
    primeHappyPath(OWNER_ID, OWNER_ID, [])
    const boardRes = await getBoard(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}`),
      boardParams()
    )
    const todosRes = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(boardRes.status).toBe(200)
    expect(todosRes.status).toBe(200)
  })

  it('member with valid session: both endpoints 200 (log showed 403)', async () => {
    primeHappyPath(MEMBER_ID, OWNER_ID, [MEMBER_ID])
    const boardRes = await getBoard(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}`),
      boardParams()
    )
    const todosRes = await getTodos(
      makeRequest(`http://localhost/api/boards/${BOARD_ID}/todos`),
      boardParams()
    )
    expect(boardRes.status).toBe(200)
    expect(todosRes.status).toBe(200)
  })
})
