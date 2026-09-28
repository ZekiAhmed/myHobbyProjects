/**
 * @fileoverview Payment review Server Actions — approve / reject
 * (subscription-billing issue 07)
 *
 * The two decisions an Administrator makes from the review queue. Both
 * follow the same shape (spec stories 41 + 42):
 *
 * 1. AUTHORIZATION — defense in depth. /admin renders behind
 *    requireAdmin(), and each action re-checks the platform role so a
 *    stale open session that lost the role is refused with an
 *    authorization ActionResult instead of a write.
 * 2. VALIDATION — a rejection reason is mandatory (trimmed, capped) and
 *    every input is parsed with zod, the house convention.
 * 3. ONE ATOMIC TRANSACTION — the status transition, the decision
 *    metadata, and (on approval) the subscriber's new period end land
 *    together or not at all (spec story 52: partial failures must never
 *    leave a subscription half-applied).
 * 4. TERMINAL-STATE GUARD — the write carries `status: PENDING` in its
 *    WHERE, so a double-click, a stale tab, or a second Administrator
 *    loses the race cleanly with a validation error instead of
 *    double-applying an outcome (spec story 42; the same compare-and-
 *    swap the upload route uses for AWAITING_UPLOAD → PENDING).
 *
 * APPROVE computes the new period end with the pure helper from issue
 * 03: `max(now, currentPeriodEnd) + 1 calendar month`, so an active
 * subscriber's early renewal stacks and a lapsed one restarts — a
 * paying subscriber never falls into a locked gap (spec §Money).
 *
 * REJECT stores the reason on the submission itself: it is the permanent
 * audit trail's part of the outcome, and issue 08 shows it back next to
 * the attempt in billing history.
 */

'use server'

import { z } from 'zod/v4'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { refuseUnlessAdministrator } from '@/lib/admin-guard'
import {
  actionSuccess,
  actionError,
  GuardError,
  type ActionResult,
} from '@/lib/errors'
import { computePeriodEnd } from '@/lib/subscription'

const ApproveSchema = z.object({
  submissionId: z.string().min(1, 'A payment submission is required'),
})

const RejectSchema = z.object({
  submissionId: z.string().min(1, 'A payment submission is required'),
  reason: z
    .string()
    .trim()
    .min(1, 'A rejection reason is required')
    .max(500, 'Keep the rejection reason under 500 characters'),
})

/** What an approval tells the caller: the period the payment bought. */
export interface ApproveResult {
  submissionId: string
  periodEnd: Date
}

/** What a rejection confirms: the attempt is decided, reason stored. */
export interface RejectResult {
  submissionId: string
}

/**
 * Approves a pending payment and starts (or extends) the subscriber's
 * paid period (Administrators only).
 *
 * @returns The new period end, or an error ActionResult: authorization
 *   for a non-Administrator, validation for an unknown or already-
 *   decided submission, server for a database failure
 */
export async function approveSubmission(input: {
  submissionId: string
}): Promise<ActionResult<ApproveResult>> {
  try {
    const session = await getRequiredSession()

    const denied = await refuseUnlessAdministrator(session.user.id, 'decide payments')
    if (denied) return denied

    const parsed = ApproveSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid payment submission')
    }

    const submissionId = parsed.data.submissionId
    const now = new Date()

    const periodEnd = await prisma.$transaction(
      async (tx) => {
        const submission = await tx.paymentSubmission.findUnique({
          where: { id: submissionId },
          select: { id: true, userId: true },
        })
        if (!submission) {
          throw new GuardError('validation', 'Payment submission not found')
        }

        // Terminal-state guard: only a genuinely PENDING row may be
        // approved. The count is the race winner's ticket — a second
        // concurrent decision matches no row and rolls the whole
        // transaction back, so the outcome applies exactly once.
        const decided = await tx.paymentSubmission.updateMany({
          where: { id: submission.id, status: 'PENDING' },
          data: { status: 'APPROVED', decidedAt: now, decidedById: session.user.id },
        })
        if (decided.count === 0) {
          throw new GuardError('validation', 'This payment has already been decided')
        }

        const subscriber = await tx.user.findUnique({
          where: { id: submission.userId },
          select: { subscriptionPeriodEnd: true },
        })
        if (!subscriber) {
          // unreachable in practice — a subscriber's submissions are
          // cascade-deleted with them — but a half-gone pair must roll
          // back rather than approve a payment for nobody
          throw new GuardError('server', 'Subscriber not found')
        }

        const nextPeriodEnd = computePeriodEnd(now, subscriber.subscriptionPeriodEnd)
        await tx.user.update({
          where: { id: submission.userId },
          data: { subscriptionPeriodEnd: nextPeriodEnd },
        })

        return nextPeriodEnd
      },
      // Serializable: approval is the one read-modify-write in billing
      // (read the current period end, write the stacked one). At READ
      // COMMITTED two approvals racing on the same subscriber could both
      // read the old end and lose a paid month; Serializable makes the
      // second abort instead. Reject needs no isolation upgrade — it
      // writes a single row through the status guard alone.
      { isolationLevel: 'Serializable' }
    )

    return actionSuccess({ submissionId, periodEnd })
  } catch (error) {
    if (error instanceof GuardError) {
      return actionError(error.kind, error.message)
    }
    return actionError('server', 'Failed to approve payment')
  }
}

/**
 * Rejects a pending payment with a mandatory reason (Administrators
 * only).
 *
 * The reason is trimmed and length-capped by the zod schema — an empty
 * or whitespace-only reason never reaches the database (spec story 41:
 * the submitter must be able to self-correct from what they are told).
 *
 * @returns An error ActionResult for a non-Administrator, a missing or
 *   invalid reason, an unknown submission, or one already decided
 */
export async function rejectSubmission(input: {
  submissionId: string
  reason: string
}): Promise<ActionResult<RejectResult>> {
  try {
    const session = await getRequiredSession()

    const denied = await refuseUnlessAdministrator(session.user.id, 'decide payments')
    if (denied) return denied

    const parsed = RejectSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid rejection reason')
    }

    const { submissionId, reason } = parsed.data
    const now = new Date()

    await prisma.$transaction(async (tx) => {
      const submission = await tx.paymentSubmission.findUnique({
        where: { id: submissionId },
        select: { id: true },
      })
      if (!submission) {
        throw new GuardError('validation', 'Payment submission not found')
      }

      // Same terminal-state guard as approval: the WHERE carries
      // `status: PENDING`, so a double-click or a stale tab cannot
      // overwrite an already-decided outcome (and cannot re-reject a
      // payment to rewrite its reason).
      const decided = await tx.paymentSubmission.updateMany({
        where: { id: submission.id, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          decidedAt: now,
          decidedById: session.user.id,
          rejectionReason: reason,
        },
      })
      if (decided.count === 0) {
        throw new GuardError('validation', 'This payment has already been decided')
      }
    })

    return actionSuccess({ submissionId })
  } catch (error) {
    if (error instanceof GuardError) {
      return actionError(error.kind, error.message)
    }
    return actionError('server', 'Failed to reject payment')
  }
}
