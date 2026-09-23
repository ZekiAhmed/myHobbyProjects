/**
 * @fileoverview Feedback loop: board page must authorize like the APIs
 *
 * SYMPTOM (dev logs):
 *   GET /boards/[id]           → 200   (page checks session only)
 *   GET /api/boards/[id]       → 403   (API checks owner OR member)
 *   GET /api/boards/[id]/todos → 403
 *
 * A stranger with a valid session gets a 200 board shell and empty/failed data.
 * Settings page already redirects non-owners; board page has no membership gate.
 *
 * CONTRACT: BoardPage must not render the board for a non-member — same
 * principal that APIs 403 must not receive a 200 page (redirect/notFound).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notFound, redirect } from 'next/navigation'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: { findUnique: vi.fn() },
  boardMember: { findFirst: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
  getOptionalSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queries/board-keys', () => ({
  boardDetailQueryOptions: (id: string) => ({
    queryKey: ['boards', id],
    queryFn: async () => ({ id, name: 'Test Board' }),
  }),
  todosQueryOptions: (id: string) => ({
    queryKey: ['boards', id, 'todos'],
    queryFn: async () => [],
  }),
  boardKeys: {
    all: () => ['boards'],
    detail: (id: string) => ['boards', id],
    todos: (id: string) => ['boards', id, 'todos'],
    invitations: (id: string) => ['boards', id, 'invitations'],
  },
}))
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
  }
})

import BoardPage from '@/app/(app)/boards/[id]/page'

const BOARD_ID = 'cmu1xspoa0000g4tu9a92yo8d'
const OWNER_ID = 'user_owner'
const MEMBER_ID = 'user_member'
const STRANGER_ID = 'user_stranger'

function pageProps() {
  return { params: Promise.resolve({ id: BOARD_ID }) }
}

function prime(sessionUserId: string, ownerId: string, memberUserIds: string[]) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: sessionUserId, email: `${sessionUserId}@t.dev` },
    session: { id: 's1' },
  })
  prismaMock.board.findUnique.mockResolvedValue({
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
  })
  prismaMock.boardMember.findFirst.mockImplementation(
    async ({ where }: { where: { userId: string } }) =>
      memberUserIds.includes(where.userId)
        ? { id: 'bm_x', boardId: BOARD_ID, userId: where.userId, joinedAt: new Date() }
        : null
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BoardPage membership gate (matches API owner-or-member rule)', () => {
  it('owner: renders without redirect/notFound', async () => {
    prime(OWNER_ID, OWNER_ID, [])
    const el = await BoardPage(pageProps())
    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('member: renders without redirect/notFound', async () => {
    prime(MEMBER_ID, OWNER_ID, [MEMBER_ID])
    const el = await BoardPage(pageProps())
    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('stranger with valid session: must NOT render board (API would 403)', async () => {
    // Exact log symptom: session OK → page 200 while APIs 403.
    // Red while BoardPage only calls getRequiredSession().
    prime(STRANGER_ID, OWNER_ID, [MEMBER_ID])
    await expect(BoardPage(pageProps())).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_REDIRECT/)
    expect(notFound).toHaveBeenCalled() // or redirect — either denies render
  })

  it('missing board: notFound', async () => {
    sessionMock.getSession.mockResolvedValue({
      user: { id: OWNER_ID, email: 'o@t.dev' },
      session: { id: 's1' },
    })
    prismaMock.board.findUnique.mockResolvedValue(null)
    await expect(BoardPage(pageProps())).rejects.toThrow(/NEXT_NOT_FOUND/)
  })
})
