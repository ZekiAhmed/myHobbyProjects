/**
 * @fileoverview Receipt byte retention — lazy pruning of decided
 * receipts (subscription-billing issue 12, spec story 50)
 *
 * The retention half of the receipt lifecycle: proof is evidence while
 * a payment is in question, and dead weight once the question is
 * settled. Receipt BYTES are removed 30 days after the decision
 * (APPROVED or REJECTED); everything else on the submission — the
 * snapshotted amount and currency, the payment reference, the
 * timestamps, the reviewer, the outcome and reason — is the financial
 * audit trail and is kept permanently. A prune writes `receiptBytes`
 * alone, so it can never delete or alter the submission row, and
 * billing history (which never selects bytes anyway) stays fully
 * readable afterwards.
 *
 * LAZY BY DESIGN (spec §Out of Scope — "no cron for … anything"): this
 * project has no scheduler infrastructure, on purpose. Pruning
 * piggybacks on ordinary reads of billing history and the admin review
 * queue (same laziness pattern as the subscribe action's AWAITING_UPLOAD
 * → EXPIRED flip): whoever reads next does the sweep. Nobody visiting
 * means bytes linger a little longer — accepted, because retention
 * here is storage hygiene, not a correctness or privacy deadline
 * enforced by a clock the app must observe.
 *
 * NOT USER-SCOPED on purpose: the sweep is operator-wide, because an
 * expired receipt must be deleted even if its owner never comes back.
 * It only ever matches decided rows, so it can never race the review
 * queue (PENDING) or an open attempt (AWAITING_UPLOAD).
 *
 * WHY NOT ONE BULK updateMany: Prisma bumps a `@updatedAt` column on
 * any non-empty write (verified against this project's Prisma 7
 * client), and `updatedAt` is rendered as a history timestamp — a bulk
 * null would silently rewrite every pruned submission's audit trail.
 * Each due row is cleared with its OWN timestamp supplied back, which
 * Prisma honors, so the only column that ever changes is
 * `receiptBytes`.
 *
 * Failure semantics: `pruneExpiredReceipts` throws on a database
 * error. Every caller is a READ, and each wraps the call so a prune
 * failure is logged and the read it rode in on still succeeds
 * (checklist: pruning failures never break the reads that trigger
 * them) — the same best-effort convention the decision emails use.
 */

import { prisma } from '@/lib/db'
import type { PaymentStatus } from '@/lib/generated/prisma/browser'

/**
 * Days a decided receipt's bytes survive before pruning (spec §Receipt
 * storage: "deleted 30 days after the decision"). Exported so tests and
 * any future surface quote the spec's number instead of a copy of it.
 */
export const RECEIPT_RETENTION_DAYS = 30

/** The retention window in milliseconds — 30 days, exactly. */
export const RECEIPT_RETENTION_MS = RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000

/**
 * The statuses whose receipts are eligible for pruning: the two
 * administrator decisions. EXPIRED and AWAITING_UPLOAD rows never hold
 * bytes (the upload route writes bytes together with the flip to
 * PENDING, and only a decision can follow), and PENDING rows are live
 * evidence — pruning waits for the verdict.
 */
const DECIDED_PAYMENT_STATUSES: PaymentStatus[] = ['APPROVED', 'REJECTED']

/**
 * The instant at — or before — which a decision's receipt bytes are due
 * for pruning: `now` minus the retention window.
 *
 * STRICTLY PURE: the caller supplies `now`, so the boundary is
 * reproducible in tests (same convention as lib/subscription.ts). The
 * input is never mutated.
 *
 * Boundary: a decision exactly `RECEIPT_RETENTION_MS` old sits ON this
 * cutoff and is pruned (`lte` in the sweep) — retention bites at the
 * instant itself, the same convention as subscription expiry.
 */
export function receiptRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - RECEIPT_RETENTION_MS)
}

/**
 * Opportunistically deletes receipt bytes whose decision is at least
 * `now` - 30 days old. The row survives with its metadata intact
 * (spec story 50): only `receiptBytes` is written — every other
 * column, `updatedAt` included, keeps its original value.
 *
 * Already-pruned rows are skipped by the `receiptBytes IS NOT NULL`
 * term, so repeated sweeps are cheap and idempotent; a sweep that
 * finds nothing due performs no writes at all.
 *
 * @returns How many rows were cleared (0 when nothing is due)
 * @throws Any database failure — callers are reads and must isolate it
 */
export async function pruneExpiredReceipts(now: Date = new Date()): Promise<number> {
  const due = await prisma.paymentSubmission.findMany({
    where: {
      status: { in: DECIDED_PAYMENT_STATUSES },
      decidedAt: { lte: receiptRetentionCutoff(now) },
      receiptBytes: { not: null },
    },
    // the row's own timestamp rides along so the write below can hand
    // it straight back to Prisma instead of letting @updatedAt move
    select: { id: true, updatedAt: true },
  })

  if (due.length === 0) return 0

  const results = await prisma.$transaction(
    due.map((row) =>
      prisma.paymentSubmission.updateMany({
        // re-checking `receiptBytes` makes a sweep racing another
        // sweep no-op instead of double-counting
        where: { id: row.id, receiptBytes: { not: null } },
        data: { receiptBytes: null, updatedAt: row.updatedAt },
      })
    )
  )

  return results.reduce((total, result) => total + result.count, 0)
}
