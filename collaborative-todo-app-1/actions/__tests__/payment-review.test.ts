/**
 * @fileoverview Server-entrypoint tests for approve / reject
 * (subscription-billing issue 07)
 *
 * CONTRACT UNDER TEST:
 *
 * approveSubmission:
 * 1. A first approval starts the clock at approval time + one calendar
 *    month (spec §Money — the period begins when a human confirms it)
 * 2. An approval while a period is still running STACKS the new month
 *    onto the current period end — no locked gap for a paying subscriber
 * 3. An approval after the period lapsed restarts at the approval
 *    instant, not from the old end
 * 4. The transition lands with its decision metadata (who + when)
 * 5. A non-Administrator is refused with authorization, before any
 *    transaction starts and with nothing written
 * 6. An already-decided submission (APPROVED / REJECTED / EXPIRED) is
 *    refused with validation and the period is NOT applied again —
 *    the terminal-state guard
 * 7. An unknown submission is refused with validation, nothing written
 * 8. Two clicks in a row apply the period exactly once (the guard is a
 *    compare-and-swap, not a read-then-write)
 * 9. The status flip and the period write run in ONE Serializable
 *    transaction (spec story 52)
 *
 * rejectSubmission:
 * 10. A rejection stores the reason with the decision metadata
 * 11. The reason is trimmed before it is stored
 * 12. An empty / whitespace-only / over-long reason is refused with
 *     validation and writes nothing (spec story 41)
 * 13. A non-Administrator is refused with authorization, no transaction
 * 14. An already-decided submission cannot be re-rejected — its stored
 *     outcome and reason are untouched
 * 15. An unknown submission is refused with validation
 * 16. The rejection runs in one transaction
 *
 * External behavior only — session and db mocked at the module boundary
 * (prior art: actions/__tests__/admin.test.ts). The fake rows below
 * behave as the database state the guards read and write, so the tests
 * assert outcomes (rows changed, ActionResult returned), never call
 * sequences for their own sake.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn(), getPlatformRole: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
  getPlatformRole: (userId: string) => sessionMock.getPlatformRole(userId),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { approveSubmission, rejectSubmission } from '@/actions/payment-review'

const ACTOR_ADMIN_ID = 'user_admin'
const SUBSCRIBER_ID = 'user_subscriber'
const SUBMISSION_ID = 'sub_1'
const MISSING_ID = 'sub_missing'

/** A fixed "now" so the expected period ends are exact dates. */
const NOW = new Date('2026-10-28T10:00:00.000Z')

type SubmissionStatus = 'AWAITING_UPLOAD' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'

type SubmissionRow = {
  id: string
  userId: string
  status: SubmissionStatus
  rejectionReason: string | null
  decidedAt: Date | null
  decidedById: string | null
}

type UserRow = { id: string; subscriptionPeriodEnd: Date | null }

/** Fake database: the rows the guards read and the writes mutate. */
let submissions: Record<string, SubmissionRow>
let users: Record<string, UserRow>

function seedSubmission(overrides: Partial<SubmissionRow> = {}): SubmissionRow {
  const row: SubmissionRow = {
    id: SUBMISSION_ID,
    userId: SUBSCRIBER_ID,
    status: 'PENDING',
    rejectionReason: null,
    decidedAt: null,
    decidedById: null,
    ...overrides,
  }
  submissions[row.id] = row
  return row
}

function seedSubscriber(subscriptionPeriodEnd: Date | null): UserRow {
  const row: UserRow = { id: SUBSCRIBER_ID, subscriptionPeriodEnd }
  users[row.id] = row
  return row
}

async function findSubmission({ where }: { where: { id: string } }) {
  const row = submissions[where.id]
  return row ? { ...row } : null
}

/** Compare-and-swap: the row must still be in the status the caller expects. */
async function decideSubmission({
  where,
  data,
}: {
  where: { id: string; status: SubmissionStatus }
  data: Partial<SubmissionRow>
}) {
  const row = submissions[where.id]
  if (!row || row.status !== where.status) return { count: 0 }
  submissions[where.id] = { ...row, ...data }
  return { count: 1 }
}

async function findUser({ where }: { where: { id: string } }) {
  const row = users[where.id]
  return row ? { ...row } : null
}

async function updateUser({ where, data }: { where: { id: string }; data: Partial<UserRow> }) {
  users[where.id] = { ...users[where.id], ...data }
  return { ...users[where.id] }
}

function signIn(userId: string, role: 'REGULAR' | 'ADMINISTRATOR' = 'ADMINISTRATOR') {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: 's1' },
  })
  sessionMock.getPlatformRole.mockResolvedValue(role)
}

beforeEach(() => {
  vi.clearAllMocks()
  submissions = {}
  users = {}

  vi.useFakeTimers()
  vi.setSystemTime(NOW)

  signIn(ACTOR_ADMIN_ID)
  prismaMock.paymentSubmission.findUnique.mockImplementation(findSubmission)
  prismaMock.paymentSubmission.updateMany.mockImplementation(decideSubmission)
  prismaMock.user.findUnique.mockImplementation(findUser)
  prismaMock.user.update.mockImplementation(updateUser)
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('approveSubmission — the subscription clock', () => {
  it('starts the clock at approval time plus one calendar month on a first approval', async () => {
    seedSubmission()
    seedSubscriber(null)

    const result = await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.periodEnd).toEqual(new Date('2026-11-28T10:00:00.000Z'))
    }
    expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toEqual(
      new Date('2026-11-28T10:00:00.000Z')
    )
  })

  it('stacks the new month onto an active period end — early renewal leaves no gap', async () => {
    seedSubmission()
    // still running for another 18 days when the payment is approved
    seedSubscriber(new Date('2026-11-15T00:00:00.000Z'))

    const result = await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(result.success).toBe(true)
    expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toEqual(
      new Date('2026-12-15T00:00:00.000Z')
    )
  })

  it('restarts at the approval instant when the previous period has lapsed', async () => {
    seedSubmission()
    seedSubscriber(new Date('2026-09-01T00:00:00.000Z'))

    await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toEqual(
      new Date('2026-11-28T10:00:00.000Z')
    )
  })

  it('records the transition with the reviewer and the decision time', async () => {
    seedSubmission()
    seedSubscriber(null)

    await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(submissions[SUBMISSION_ID]).toMatchObject({
      status: 'APPROVED',
      decidedAt: NOW,
      decidedById: ACTOR_ADMIN_ID,
    })
  })
})

describe('approveSubmission — authorization & guards', () => {
  it('refuses a non-Administrator with authorization and starts no transaction', async () => {
    signIn('user_regular', 'REGULAR')
    seedSubmission()
    seedSubscriber(null)

    const result = await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('authorization')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(submissions[SUBMISSION_ID].status).toBe('PENDING')
    expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toBeNull()
  })

  it.each<SubmissionStatus>(['APPROVED', 'REJECTED', 'EXPIRED'])(
    'refuses a %s submission — the terminal-state guard never re-applies a decision',
    async (status) => {
      seedSubmission({ status, rejectionReason: 'amount mismatch' })
      seedSubscriber(null)

      const result = await approveSubmission({ submissionId: SUBMISSION_ID })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
        expect(result.error.message).toMatch(/already been decided/i)
      }
      // the outcome and the subscriber's clock are both untouched
      expect(submissions[SUBMISSION_ID].status).toBe(status)
      expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toBeNull()
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    }
  )

  it('refuses an unknown submission with validation and writes nothing', async () => {
    seedSubscriber(null)

    const result = await approveSubmission({ submissionId: MISSING_ID })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('validation')
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('applies the period exactly once across two consecutive clicks', async () => {
    seedSubmission()
    seedSubscriber(null)

    const first = await approveSubmission({ submissionId: SUBMISSION_ID })
    const second = await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(first.success).toBe(true)
    expect(second.success).toBe(false)
    if (!second.success) expect(second.error.type).toBe('validation')
    // one paid month, not two stacked onto each other
    expect(users[SUBSCRIBER_ID].subscriptionPeriodEnd).toEqual(
      new Date('2026-11-28T10:00:00.000Z')
    )
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
  })

  it('runs the transition and the period write in one Serializable transaction', async () => {
    seedSubmission()
    seedSubscriber(null)

    const result = await approveSubmission({ submissionId: SUBMISSION_ID })

    expect(result.success).toBe(true)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
    expect(prismaMock.paymentSubmission.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
  })
})

describe('rejectSubmission — mandatory reason', () => {
  it('rejects a pending submission and stores the reason with the decision metadata', async () => {
    seedSubmission()

    const result = await rejectSubmission({
      submissionId: SUBMISSION_ID,
      reason: 'Amount mismatch — received 90 ETB, expected 250 ETB',
    })

    expect(result.success).toBe(true)
    expect(submissions[SUBMISSION_ID]).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Amount mismatch — received 90 ETB, expected 250 ETB',
      decidedAt: NOW,
      decidedById: ACTOR_ADMIN_ID,
    })
    // a rejection never touches the subscriber's clock
    expect(users).toEqual({})
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('stores the trimmed reason, not the padding it arrived with', async () => {
    seedSubmission()

    await rejectSubmission({ submissionId: SUBMISSION_ID, reason: '  wrong account  ' })

    expect(submissions[SUBMISSION_ID].rejectionReason).toBe('wrong account')
  })

  it.each(['', '   ', '\n\t'])(
    'refuses the empty reason %s with validation and writes nothing',
    async (reason) => {
      seedSubmission()

      const result = await rejectSubmission({ submissionId: SUBMISSION_ID, reason })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
        expect(result.error.message).toMatch(/reason/i)
      }
      expect(submissions[SUBMISSION_ID].status).toBe('PENDING')
      expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    }
  )

  it('refuses an over-long reason so a paste cannot store unbounded text', async () => {
    seedSubmission()

    const result = await rejectSubmission({
      submissionId: SUBMISSION_ID,
      reason: 'x'.repeat(501),
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('validation')
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })

  it('refuses a non-Administrator with authorization and starts no transaction', async () => {
    signIn('user_regular', 'REGULAR')
    seedSubmission()

    const result = await rejectSubmission({ submissionId: SUBMISSION_ID, reason: 'nope' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('authorization')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(submissions[SUBMISSION_ID].status).toBe('PENDING')
  })

  it('refuses to re-reject a decided submission — its outcome and reason are final', async () => {
    seedSubmission({
      status: 'REJECTED',
      rejectionReason: 'original reason',
      decidedAt: new Date('2026-10-27T09:00:00.000Z'),
      decidedById: 'user_other_admin',
    })

    const result = await rejectSubmission({ submissionId: SUBMISSION_ID, reason: 'second guess' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('validation')
    // the guarded write matched no row: the original outcome stands
    expect(submissions[SUBMISSION_ID]).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'original reason',
      decidedById: 'user_other_admin',
    })
  })

  it('refuses an unknown submission with validation', async () => {
    const result = await rejectSubmission({ submissionId: MISSING_ID, reason: 'nope' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.type).toBe('validation')
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })

  it('runs the rejection in exactly one transaction', async () => {
    seedSubmission()

    await rejectSubmission({ submissionId: SUBMISSION_ID, reason: 'amount mismatch' })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function))
    expect(prismaMock.paymentSubmission.updateMany).toHaveBeenCalledTimes(1)
  })
})
