/**
 * @fileoverview Server-entrypoint tests for the Activity page gate
 *
 * CONTRACT UNDER TEST (GET /boards/[id]/activity):
 * 1. Owner and member render the page (they may read the board's history)
 * 2. A stranger with a valid session gets notFound — the page's denial must
 *    match the API's 403 (no 200 page, no route-based Activity log
 *    enumeration)
 * 3. A missing board gets notFound
 *
 * The feed is client-rendered (infinite pagination), so no React Query
 * server test applies here; ActivityFeed is mocked at the module boundary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notFound, redirect } from 'next/navigation'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({ board: { findUnique: vi.fn() } }))
const activityFeedMock = vi.hoisted(() => ({
  ActivityFeed: ({ boardId }: { boardId: string }) => `feed:${boardId}`,
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/components/board/ActivityFeed', () => ({
  ActivityFeed: activityFeedMock.ActivityFeed,
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

import BoardActivityPage from '@/app/(app)/boards/[id]/activity/page'

const BOARD_ID = 'board_1'
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
    ownerId,
    members: memberUserIds.map((userId) => ({ userId })),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BoardActivityPage membership gate (matches API owner-or-member rule)', () => {
  it('owner: renders the feed without redirect/notFound', async () => {
    prime(OWNER_ID, OWNER_ID, [])

    const el = await BoardActivityPage(pageProps())

    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('member: renders the feed without redirect/notFound', async () => {
    prime(MEMBER_ID, OWNER_ID, [MEMBER_ID])

    const el = await BoardActivityPage(pageProps())

    expect(el).toBeTruthy()
    expect(notFound).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('stranger with valid session: must NOT render the feed (API would 403)', async () => {
    prime(STRANGER_ID, OWNER_ID, [MEMBER_ID])

    await expect(BoardActivityPage(pageProps())).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_REDIRECT/)
    expect(notFound).toHaveBeenCalled()
  })

  it('missing board: notFound', async () => {
    sessionMock.getSession.mockResolvedValue({
      user: { id: OWNER_ID, email: 'o@t.dev' },
      session: { id: 's1' },
    })
    prismaMock.board.findUnique.mockResolvedValue(null)

    await expect(BoardActivityPage(pageProps())).rejects.toThrow(/NEXT_NOT_FOUND/)
    expect(prismaMock.board.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BOARD_ID } })
    )
  })
})
