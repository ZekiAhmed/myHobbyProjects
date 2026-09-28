/**
 * @fileoverview Server-entrypoint tests for starting a payment attempt
 * (subscription-billing issue 04)
 *
 * CONTRACT UNDER TEST (requestPaymentInstructions):
 * 1. A signed-in free user with no open attempt gets a new AWAITING_
 *    UPLOAD submission: unique payment reference, price/currency
 *    snapshot from the settings record, and a 48-hour TTL — created
 *    inside one transaction (spec §Payment lifecycle)
 * 2. A live attempt blocks a second one with an actionable error that
 *    names the existing reference; a PENDING (under-review) attempt
 *    blocks too — one non-terminal submission per user, always
 * 3. A stale AWAITING_UPLOAD (TTL passed) is lazily flipped to EXPIRED
 *    inside the same transaction, after which the new attempt succeeds —
 *    an abandoned attempt can never deadlock future ones (issue 04)
 * 4. No session means no attempt: the action surfaces the session error
 *    and touches nothing
 * 5. A database failure surfaces as a server error, never a success
 *
 * External behavior only — session and db mocked at the module boundary
 * (prior art: actions/__tests__/pricing-settings.test.ts,
 * actions/__tests__/admin.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { requestPaymentInstructions } from '@/actions/subscribe'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

/** The transaction client the action body receives. */
const txMock = {
  paymentSubmission: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  pricingSettings: {
    findUnique: vi.fn(),
  },
}

const SETTINGS_ROW = {
  id: PRICING_SETTINGS_ID,
  price: 150,
  currency: 'ETB',
  accountHolder: 'Zeki Ahmed',
  accountNumber: '123456789012',
  bankName: 'Commercial Bank of Ethiopia',
  transferInstructions: 'Include your payment reference in the memo.',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
}

const NOW = new Date('2026-09-28T12:00:00.000Z')
const EXPIRES_AT = new Date('2026-09-30T12:00:00.000Z') // NOW + 48h

function signIn(userId = 'user_free') {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  // the action runs its body inside $transaction; hand it the tx client
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)
  )
  // default world: no open attempt, settings row present, create echoes back
  txMock.paymentSubmission.findMany.mockResolvedValue([])
  txMock.pricingSettings.findUnique.mockResolvedValue(SETTINGS_ROW)
  txMock.paymentSubmission.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'sub_1',
      createdAt: NOW,
      updatedAt: NOW,
      ...data,
    })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('requestPaymentInstructions (starting a payment attempt)', () => {
  it('creates an AWAITING_UPLOAD submission with a unique reference, price snapshot, and 48h TTL in one transaction', async () => {
    signIn('user_free')

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('AWAITING_UPLOAD')
      expect(result.data.reference).toMatch(/^PAY-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      // snapshot: what the administrator verifies against, immune to
      // later price edits (spec §Money)
      expect(result.data.priceSnapshot).toBe(150)
      expect(result.data.currencySnapshot).toBe('ETB')
      // the 48-hour TTL, as an exact literal from the spec
      expect(result.data.expiresAt).toEqual(EXPIRES_AT)
    }

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.paymentSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_free',
        status: 'AWAITING_UPLOAD',
        reference: expect.stringMatching(/^PAY-[A-Z2-9]{4}-[A-Z2-9]{4}$/),
        priceSnapshot: 150,
        currencySnapshot: 'ETB',
        expiresAt: EXPIRES_AT,
      }),
    })
  })

  it('snapshots the 100 ETB seed defaults when the settings row is missing', async () => {
    signIn('user_free')
    txMock.pricingSettings.findUnique.mockResolvedValue(null)

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priceSnapshot).toBe(100)
      expect(result.data.currencySnapshot).toBe('ETB')
    }
  })

  it('blocks a second attempt while one is live, with an actionable error naming the reference', async () => {
    signIn('user_free')
    txMock.paymentSubmission.findMany.mockResolvedValue([
      {
        id: 'sub_live',
        userId: 'user_free',
        reference: 'PAY-LIVE-0001',
        status: 'AWAITING_UPLOAD',
        priceSnapshot: 150,
        currencySnapshot: 'ETB',
        expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
      // actionable: names the attempt that blocks, and says what to do
      expect(result.error.message).toContain('PAY-LIVE-0001')
      expect(result.error.message).toMatch(/receipt/i)
    }
    // nothing written: the live attempt is neither expired nor duplicated
    expect(txMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(txMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('blocks a new attempt while one is already under review (PENDING)', async () => {
    signIn('user_free')
    txMock.paymentSubmission.findMany.mockResolvedValue([
      {
        id: 'sub_pending',
        userId: 'user_free',
        reference: 'PAY-REVW-0002',
        status: 'PENDING',
        priceSnapshot: 150,
        currencySnapshot: 'ETB',
        expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
      expect(result.error.message).toContain('PAY-REVW-0002')
      expect(result.error.message).toMatch(/review/i)
    }
    expect(txMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(txMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('lazily expires a stale attempt inside the same transaction, then creates the new one', async () => {
    signIn('user_free')
    // TTL passed with no receipt — stale, but still AWAITING_UPLOAD
    txMock.paymentSubmission.findMany.mockResolvedValue([
      {
        id: 'sub_stale',
        userId: 'user_free',
        reference: 'PAY-OLD1-0003',
        status: 'AWAITING_UPLOAD',
        priceSnapshot: 150,
        currencySnapshot: 'ETB',
        expiresAt: new Date(NOW.getTime() - 1000),
        createdAt: NOW,
        updatedAt: NOW,
      },
    ])

    const result = await requestPaymentInstructions()

    // the stale record never deadlocks a fresh attempt (issue 04)
    expect(result.success).toBe(true)
    expect(txMock.paymentSubmission.update).toHaveBeenCalledWith({
      where: { id: 'sub_stale' },
      data: { status: 'EXPIRED' },
    })
    expect(txMock.paymentSubmission.create).toHaveBeenCalledTimes(1)
  })

  it('creates nothing when there is no session', async () => {
    sessionMock.getSession.mockRejectedValue(new Error('NEXT_REDIRECT:/sign-in'))

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(false)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(txMock.paymentSubmission.create).not.toHaveBeenCalled()
  })

  it('surfaces a database failure as a server error, never a success', async () => {
    signIn('user_free')
    prismaMock.$transaction.mockRejectedValue(new Error('connection reset'))

    const result = await requestPaymentInstructions()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('server')
    }
  })
})
