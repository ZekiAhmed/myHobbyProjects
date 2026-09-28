/**
 * @fileoverview Server-entrypoint tests for the billing history read
 * (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (GET /api/billing/submissions):
 * 1. Scoped to the acting user only — a submission is private financial
 *    history; a Member can never read (or be read) another user's rows
 * 2. Returns every attempt newest-first with status, timestamps, amount,
 *    and reference (story 14) — the fields the history page renders
 * 3. Receipt BYTES are never selected: the read is metadata-only, so a
 *    multi-megabyte receipt can never travel to the client
 * 4. An empty history is a valid 200 with an empty list
 *
 * External behavior only — db and session mocked at the module boundary
 * per spec §Testing Decisions (prior art:
 * app/api/notifications/__tests__/route.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findMany: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { GET as getBillingSubmissions } from '@/app/api/billing/submissions/route'

const USER_ID = 'user_subscriber'
const MEMBER_ID = 'user_member'

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: 's1' },
  })
}

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    userId: USER_ID,
    reference: 'PAY-ABCD-1234',
    status: 'PENDING',
    priceSnapshot: 250,
    currencySnapshot: 'ETB',
    expiresAt: new Date('2026-09-30T12:00:00.000Z'),
    receiptBytes: new Uint8Array([0xff, 0xd8, 0xff]),
    receiptMimeType: 'image/jpeg',
    createdAt: new Date('2026-09-28T09:00:00.000Z'),
    updatedAt: new Date('2026-09-28T10:00:00.000Z'),
    ...overrides,
  }
}

/**
 * Mimics Prisma's `select` projection, so response-level assertions are
 * real: a row carrying receipt bytes still reaches the client unselected
 * exactly as it would through the real client.
 */
function findManyHonoringSelect(rows: Record<string, unknown>[], select?: Record<string, boolean>) {
  if (!select) return rows
  return rows.map((row) =>
    Object.fromEntries(
      Object.keys(select)
        .filter((key) => select[key])
        .map((key) => [key, row[key]])
    )
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  signIn(USER_ID)
  prismaMock.paymentSubmission.findMany.mockResolvedValue([])
})

describe('GET /api/billing/submissions — scoping', () => {
  it('reads only the acting user’s submissions', async () => {
    signIn(MEMBER_ID)

    const res = await getBillingSubmissions()

    expect(res.status).toBe(200)
    expect(prismaMock.paymentSubmission.findMany).toHaveBeenCalledTimes(1)
    const { where } = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
    expect(where.userId).toBe(MEMBER_ID)
  })

  it('lists attempts newest-first — a durable record reads latest attempt first', async () => {
    await getBillingSubmissions()

    const { orderBy } = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
    expect(orderBy).toEqual({ createdAt: 'desc' })
  })
})

describe('GET /api/billing/submissions — metadata only, never receipt bytes', () => {
  it('never selects receiptBytes (or the user relation) — the read is metadata-only', async () => {
    await getBillingSubmissions()

    const { select } = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
    expect(select).not.toHaveProperty('receiptBytes')
    expect(select).not.toHaveProperty('userId')
    // the fields the history page renders (story 14)
    expect(select).toMatchObject({
      id: true,
      reference: true,
      status: true,
      priceSnapshot: true,
      currencySnapshot: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
    })
  })

  it('returns status, timestamps, amount, and reference per attempt', async () => {
    prismaMock.paymentSubmission.findMany.mockImplementation(
      async (args: { select?: Record<string, boolean> } | undefined) =>
        findManyHonoringSelect([submissionRow()], args?.select)
    )

    const res = await getBillingSubmissions()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.submissions).toHaveLength(1)
    expect(body.submissions[0]).toMatchObject({
      id: 'sub_1',
      reference: 'PAY-ABCD-1234',
      status: 'PENDING',
      priceSnapshot: 250,
      currencySnapshot: 'ETB',
      createdAt: '2026-09-28T09:00:00.000Z',
      updatedAt: '2026-09-28T10:00:00.000Z',
      expiresAt: '2026-09-30T12:00:00.000Z',
    })
    expect(JSON.stringify(body)).not.toContain('receiptBytes')
  })
})

describe('GET /api/billing/submissions — empty history', () => {
  it('is a valid 200 with an empty list when the user has no attempts', async () => {
    const res = await getBillingSubmissions()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ submissions: [] })
  })
})
