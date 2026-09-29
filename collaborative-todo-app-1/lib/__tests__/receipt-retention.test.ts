/**
 * @fileoverview Retention tests for receipt byte pruning
 * (subscription-billing issue 12)
 *
 * CONTRACT UNDER TEST (receiptRetentionCutoff + pruneExpiredReceipts):
 * 1. The cutoff is EXACTLY 30 days before the caller's `now` — no clock
 *    inside the helper (same convention as lib/subscription.ts), so the
 *    boundary is reproducible in tests
 * 2. The sweep selects only DECIDED rows (APPROVED or REJECTED) whose
 *    decision is at or before the cutoff AND that still hold bytes, and
 *    the boundary is inclusive AT the cutoff: a decision exactly 30
 *    days old is pruned, one millisecond younger is not (the "bites at
 *    the instant" convention of deriveSubscription)
 * 3. The write nulls `receiptBytes` and NOTHING else — each row's own
 *    `updatedAt` is handed back to Prisma (which would otherwise bump
 *    @updatedAt on any non-empty write), so the row, its snapshotted
 *    amount/currency, reference, timestamps, reviewer and outcome are
 *    the permanent financial audit trail (spec story 50); deleting
 *    bytes never deletes or alters the submission
 * 4. Nothing due ⇒ no writes at all; the returned count is how many
 *    rows were actually cleared
 * 5. Failure PROPAGATES — the caller (a read) isolates it so pruning
 *    can never break the read that triggered it (covered at the route
 *    seam); this helper stays honest about errors
 *
 * External behavior only — prisma mocked at the module boundary
 * (prior art: lib/__tests__/pricing-settings.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findMany: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  RECEIPT_RETENTION_DAYS,
  RECEIPT_RETENTION_MS,
  receiptRetentionCutoff,
  pruneExpiredReceipts,
} from '@/lib/receipt-retention'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-29T12:00:00.000Z')
const CUTOFF = new Date(NOW.getTime() - 30 * DAY_MS)

function dueRow(id: string, updatedAt: Date) {
  return { id, updatedAt }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.paymentSubmission.findMany.mockResolvedValue([])
  prismaMock.paymentSubmission.updateMany.mockResolvedValue({ count: 1 })
  // the batch form resolves with the operations' results
  prismaMock.$transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations)
  )
})

describe('receiptRetentionCutoff', () => {
  it('is exactly 30 days before the caller-supplied now', () => {
    expect(RECEIPT_RETENTION_DAYS).toBe(30)
    expect(RECEIPT_RETENTION_MS).toBe(30 * DAY_MS)
    expect(receiptRetentionCutoff(NOW)).toEqual(new Date('2026-08-30T12:00:00.000Z'))
  })

  it('never mutates the caller’s clock', () => {
    const now = new Date(NOW)

    receiptRetentionCutoff(now)

    expect(now).toEqual(NOW)
  })
})

describe('pruneExpiredReceipts — the 30-day boundary', () => {
  it('selects decided rows at or before the cutoff — exactly 30 days old is pruned (inclusive)', async () => {
    await pruneExpiredReceipts(NOW)

    expect(prismaMock.paymentSubmission.findMany).toHaveBeenCalledTimes(1)
    const { where, select } = prismaMock.paymentSubmission.findMany.mock.calls[0][0]
    // `lte` (not `lt`): a decision made exactly 30 days before `now`
    // sits ON the cutoff and is removed — retention bites at the instant
    expect(where.decidedAt).toEqual({ lte: CUTOFF })
    // decided outcomes only — nothing awaiting review or undecidable
    expect(where.status).toEqual({ in: ['APPROVED', 'REJECTED'] })
    // rows that no longer hold bytes are skipped, so re-running an
    // already-pruned history selects (and writes) nothing
    expect(where.receiptBytes).toEqual({ not: null })
    // the row's own timestamp must ride along to be handed back on write
    expect(select).toEqual({ id: true, updatedAt: true })
  })

  it('performs no writes at all when nothing is due', async () => {
    const cleared = await pruneExpiredReceipts(NOW)

    expect(cleared).toBe(0)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })
})

describe('pruneExpiredReceipts — metadata preservation (story 50)', () => {
  it('nulls receipt bytes and nothing else: each row’s own updatedAt is handed back', async () => {
    const rowOne = dueRow('sub_1', new Date('2026-06-01T10:00:00.000Z'))
    const rowTwo = dueRow('sub_2', new Date('2026-07-15T08:30:00.000Z'))
    prismaMock.paymentSubmission.findMany.mockResolvedValue([rowOne, rowTwo])

    await pruneExpiredReceipts(NOW)

    expect(prismaMock.paymentSubmission.updateMany).toHaveBeenCalledTimes(2)
    const [first, second] = prismaMock.paymentSubmission.updateMany.mock.calls
    // re-checking the guard keeps a racing sweep from double-counting
    expect(first[0].where).toEqual({ id: 'sub_1', receiptBytes: { not: null } })
    expect(first[0].data).toEqual({ receiptBytes: null, updatedAt: rowOne.updatedAt })
    expect(second[0].where).toEqual({ id: 'sub_2', receiptBytes: { not: null } })
    expect(second[0].data).toEqual({ receiptBytes: null, updatedAt: rowTwo.updatedAt })
    // the permanent trail — amount, reference, decision columns,
    // createdAt — is not written at all, so a prune cannot touch it
    expect(Object.keys(first[0].data).sort()).toEqual(['receiptBytes', 'updatedAt'])
  })

  it('reports how many rows it actually cleared', async () => {
    prismaMock.paymentSubmission.findMany.mockResolvedValue([
      dueRow('sub_1', new Date('2026-06-01T10:00:00.000Z')),
      dueRow('sub_2', new Date('2026-07-15T08:30:00.000Z')),
    ])
    // one row vanished between selection and write (count 0), one cleared
    prismaMock.paymentSubmission.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await expect(pruneExpiredReceipts(NOW)).resolves.toBe(1)
  })
})

describe('pruneExpiredReceipts — failure propagation', () => {
  it('surfaces a selection failure to its caller instead of swallowing it', async () => {
    prismaMock.paymentSubmission.findMany.mockRejectedValue(new Error('connection reset'))

    await expect(pruneExpiredReceipts(NOW)).rejects.toThrow('connection reset')
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('surfaces a write failure to its caller instead of swallowing it', async () => {
    prismaMock.paymentSubmission.findMany.mockResolvedValue([
      dueRow('sub_1', new Date('2026-06-01T10:00:00.000Z')),
    ])
    prismaMock.$transaction.mockRejectedValue(new Error('connection reset'))

    await expect(pruneExpiredReceipts(NOW)).rejects.toThrow('connection reset')
  })
})
