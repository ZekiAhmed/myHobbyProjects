/**
 * @fileoverview Server-entrypoint tests for the Comment feed read
 *
 * CONTRACT UNDER TEST (GET /api/todos/[id]/comments):
 * 1. Non-members get 403 even with a valid Todo id (same posture as board detail)
 * 2. Page returns comments oldest → newest
 * 3. Page boundary: 20 per page with a `nextCursor` continuation contract for "Load older"
 *
 * External behavior only — db and session mocked at the module boundary per
 * spec §Testing Decisions (prior art: app/api/boards/[id]/__tests__/authz.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  todo: { findUnique: vi.fn() },
  board: { findUnique: vi.fn() },
  boardMember: { findFirst: vi.fn() },
  comment: { findUnique: vi.fn(), findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getComments } from '@/app/api/todos/[id]/comments/route'

const TODO_ID = 'todo_1'
const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const STRANGER_ID = 'user_stranger'

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

function todoParams() {
  return { params: Promise.resolve({ id: TODO_ID }) }
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

function primeAccess(ownerId: string, memberUserIds: string[]) {
  prismaMock.todo.findUnique.mockResolvedValue({ id: TODO_ID, boardId: BOARD_ID })
  prismaMock.board.findUnique.mockResolvedValue({ id: BOARD_ID, ownerId })
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { boardId: string; userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: where.boardId, userId: where.userId, joinedAt: new Date() }
        : null
  )
}

function commentRow(id: string, minutesAfterEpoch: number, body = `body ${id}`) {
  return {
    id,
    body,
    todoId: TODO_ID,
    authorId: MEMBER_ID,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutesAfterEpoch)),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, minutesAfterEpoch)),
    author: { id: MEMBER_ID, name: 'Member', image: null },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/todos/[id]/comments — membership', () => {
  it('rejects a non-member even with a valid Todo id', async () => {
    signIn(STRANGER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments`),
      todoParams()
    )

    expect(res.status).toBe(403)
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled()
  })

  it('rejects with 404 when the Todo does not exist', async () => {
    signIn(MEMBER_ID)
    prismaMock.todo.findUnique.mockResolvedValue(null)

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments`),
      todoParams()
    )

    expect(res.status).toBe(404)
  })
})

describe('GET /api/todos/[id]/comments — page order', () => {
  it('returns a page ordered oldest → newest', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // newest first, the order the route asks Prisma for (desc window fetch)
    prismaMock.comment.findMany.mockResolvedValue([
      commentRow('c3', 2, 'newest'),
      commentRow('c2', 1, 'middle'),
      commentRow('c1', 0, 'oldest'),
    ])

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments`),
      todoParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.comments.map((c: { id: string }) => c.id)).toEqual(['c1', 'c2', 'c3'])
    expect(payload.comments[0]).toMatchObject({
      body: 'oldest',
      author: { id: MEMBER_ID, name: 'Member' },
    })
  })
})

describe('GET /api/todos/[id]/comments — boundary and continuation', () => {
  it('returns at most 20 comments with a nextCursor when older pages exist', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // 21 rows newest → oldest: c21 … c1
    prismaMock.comment.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => commentRow(`c${21 - i}`, 21 - i))
    )

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments`),
      todoParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.comments).toHaveLength(20)
    expect(payload.comments[0].id).toBe('c2')
    expect(payload.comments[19].id).toBe('c21')
    expect(payload.nextCursor).toBe('c2')
  })

  it('returns nextCursor null when the page reaches the start of the feed', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // exactly 20 rows newest → oldest: c20 … c1
    prismaMock.comment.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => commentRow(`c${20 - i}`, 20 - i))
    )

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments`),
      todoParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.comments).toHaveLength(20)
    expect(payload.comments[0].id).toBe('c1')
    expect(payload.nextCursor).toBeNull()
  })

  it('pages backward from the before cursor', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    const cursorRow = commentRow('c21', 21)
    prismaMock.comment.findUnique.mockResolvedValue(cursorRow)
    // only comments older than the cursor come back from the db
    prismaMock.comment.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => commentRow(`c${20 - i}`, 20 - i))
    )

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments?before=c21`),
      todoParams()
    )

    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.comments).toHaveLength(20)
    expect(payload.nextCursor).toBe('c1')
  })

  it('returns 400 for an unknown before cursor', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments?before=missing`),
      todoParams()
    )

    expect(res.status).toBe(400)
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled()
  })

  it('returns 400 for a cursor that belongs to a different todo', async () => {
    signIn(MEMBER_ID)
    primeAccess(OWNER_ID, [MEMBER_ID])
    // the fake db holds the cursor row — but under a different todo, so a
    // lookup scoped to this todo must not resolve it
    prismaMock.comment.findUnique.mockImplementation(
      async ({ where }: { where: { id: string; todoId?: string } }) => {
        if (where.id !== 'foreign_cursor') return null
        const row = { ...commentRow('foreign_cursor', 5), todoId: 'todo_other' }
        if (where.todoId !== undefined && where.todoId !== row.todoId) return null
        return row
      }
    )
    prismaMock.comment.findMany.mockResolvedValue([])

    const res = await getComments(
      makeRequest(`http://localhost/api/todos/${TODO_ID}/comments?before=foreign_cursor`),
      todoParams()
    )

    expect(res.status).toBe(400)
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled()
  })
})
