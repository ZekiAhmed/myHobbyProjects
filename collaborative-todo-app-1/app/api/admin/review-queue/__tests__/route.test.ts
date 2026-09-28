/**
 * @fileoverview Server-entrypoint tests for the admin review queue
 * (subscription-billing issue 07)
 *
 * CONTRACT UNDER TEST (GET /api/admin/review-queue):
 * 1. An Administrator gets the queue: PENDING rows only, longest
 *    waiting first (spec story 35 — the 24-hour promise is honored
 *    fairly; ordering runs on `updatedAt`, queue entry, the same
 *    clock the aging badge counts down from)
 * 2. Every row carries what makes verification a five-second match
 *    (story 39): snapshotted amount + currency, the submitter's name and
 *    email, the submission time, and the payment reference
 * 3. Receipt bytes never ride on this wire — the select list is metadata
 *    only; the blob is read through the admin-gated viewer route
 * 4. A signed-in non-Administrator gets 403 before any queue read
 * 5. A signed-out caller is stopped by the session gate — no role
 *    lookup, no queue read
 * 6. An empty queue is a 200 with an empty list, not an error
 *
 * External behavior only — session and db mocked at the module boundary
 * (prior art: app/api/billing/submissions/__tests__/route.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn(), getPlatformRole: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  // mirrors the real helper: no session means the sign-in redirect is
  // thrown before the handler can look anything up
  getRequiredSession: async () => {
    const session = await sessionMock.getSession()
    if (!session) throw new Error('NEXT_REDIRECT:/sign-in')
    return session
  },
  getPlatformRole: (userId: string) => sessionMock.getPlatformRole(userId),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getReviewQueue } from '@/app/api/admin/review-queue/route'

const ADMIN_ID = 'user_admin'
const REGULAR_ID = 'user_regular'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: 's1' },
  })
}

function pendingRow(id: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reference: `PAY-${id.toUpperCase()}`,
    status: 'PENDING',
    priceSnapshot: 250,
    currencySnapshot: 'ETB',
    receiptMimeType: 'image/jpeg',
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    user: { id: 'user_subscriber', name: 'Sub User', email: 'sub@t.dev' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  signIn(ADMIN_ID)
  sessionMock.getPlatformRole.mockResolvedValue('ADMINISTRATOR')
  prismaMock.paymentSubmission.findMany.mockResolvedValue([])
})

describe('GET /api/admin/review-queue — authorization', () => {
  it('returns 403 to a signed-in non-Administrator without reading the queue', async () => {
    signIn(REGULAR_ID)
    sessionMock.getPlatformRole.mockResolvedValue('REGULAR')

    const res = await getReviewQueue()

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/administrator/i)
    expect(prismaMock.paymentSubmission.findMany).not.toHaveBeenCalled()
  })

  it('stops a signed-out caller at the session gate — no role lookup, no queue read', async () => {
    sessionMock.getSession.mockResolvedValue(null)

    await expect(getReviewQueue()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    expect(sessionMock.getPlatformRole).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.findMany).not.toHaveBeenCalled()
  })

  it('re-checks the role even though /admin already rendered behind requireAdmin()', async () => {
    // defense in depth: a session that lost the role between page render
    // and fetch must not receive the queue
    signIn(REGULAR_ID)
    sessionMock.getPlatformRole.mockResolvedValue('REGULAR')

    const res = await getReviewQueue()

    expect(res.status).toBe(403)
    expect(sessionMock.getPlatformRole).toHaveBeenCalledWith(REGULAR_ID)
  })
})

describe('GET /api/admin/review-queue — queue contents', () => {
  it('asks for PENDING rows only, longest waiting first', async () => {
    await getReviewQueue()

    expect(prismaMock.paymentSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        orderBy: { updatedAt: 'asc' },
      })
    )
  })

  it('returns the rows in the database order — longest-waiting submission first', async () => {
    const rows = [
      pendingRow('sub_1', '2026-09-26T08:00:00.000Z'),
      pendingRow('sub_2', '2026-09-27T09:30:00.000Z'),
      pendingRow('sub_3', '2026-09-28T10:00:00.000Z'),
    ]
    prismaMock.paymentSubmission.findMany.mockResolvedValue(rows)

    const res = await getReviewQueue()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.submissions.map((s: { id: string }) => s.id)).toEqual([
      'sub_1',
      'sub_2',
      'sub_3',
    ])
  })

  it('carries the snapshot amount, submitter identity, submission time, and reference', async () => {
    prismaMock.paymentSubmission.findMany.mockResolvedValue([
      pendingRow('sub_1', '2026-09-27T09:30:00.000Z'),
    ])

    const res = await getReviewQueue()
    const [row] = (await res.json()).submissions

    expect(row).toMatchObject({
      reference: 'PAY-SUB_1',
      priceSnapshot: 250,
      currencySnapshot: 'ETB',
      user: { id: 'user_subscriber', name: 'Sub User', email: 'sub@t.dev' },
    })
    expect(new Date(row.createdAt).toISOString()).toBe('2026-09-27T09:30:00.000Z')
    // the aging anchor must ride on the wire — the badge counts down
    // from queue entry, not instruction creation
    expect(new Date(row.updatedAt).toISOString()).toBe('2026-09-27T09:30:00.000Z')
  })

  it('never puts receipt bytes on the queue wire — metadata select only', async () => {
    await getReviewQueue()

    const { select } = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
    expect(select).not.toHaveProperty('receiptBytes')
    // the card still needs to know a receipt exists to offer the viewer
    expect(select).toHaveProperty('receiptMimeType')
    // the WHERE already pins every row to PENDING — status would be a
    // constant echoed on the wire
    expect(select).not.toHaveProperty('status')
  })

  it('answers an empty queue with an empty list', async () => {
    prismaMock.paymentSubmission.findMany.mockResolvedValue([])

    const res = await getReviewQueue()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ submissions: [] })
  })
})
