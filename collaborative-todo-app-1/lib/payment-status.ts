/**
 * @fileoverview Payment status presentation — the single source of truth
 * for how a PaymentStatus reads to the subscriber
 * (subscription-billing issue 06)
 *
 * Three surfaces show a submission's status — the upgrade screen's status
 * card, the dashboard's pending-review banner, and the billing history
 * page — and all three must say the same thing (checklist: "All statuses
 * shown include the 24-hour review promise copy"). One pure helper means
 * the copy cannot drift between them.
 *
 * STRICTLY PURE: a status in, display strings out — no I/O, no clock.
 *
 * The 24-hour promise is deliberately part of every detail line, in the
 * past tense where the review already happened: the promise is an
 * operational commitment (spec §Money — "the upgrade UI promises review
 * within 24 hours"), and history rows are read long after the fact.
 */

import type { PaymentStatus } from '@/lib/generated/prisma/browser'

/**
 * The turnaround promise, verbatim. Re-exported for surfaces that show
 * it as a standalone note (the billing history page footer).
 */
export const REVIEW_PROMISE_COPY = 'Receipts are reviewed within 24 hours.'

interface StatusCopy {
  /** Short label — the badge/heading. */
  label: string
  /** One sentence shown under the label; always carries the promise. */
  detail: string
}

/**
 * Copy per status, typed as a Record so the compiler rejects the file
 * the moment a new PaymentStatus exists without copy of its own.
 */
const PAYMENT_STATUS_COPY: Record<PaymentStatus, StatusCopy> = {
  AWAITING_UPLOAD: {
    label: 'Awaiting receipt',
    detail: `Transfer first, then upload your receipt — ${REVIEW_PROMISE_COPY}`,
  },
  PENDING: {
    label: 'Under review',
    detail: 'Receipt submitted — awaiting review, within 24 hours.',
  },
  APPROVED: {
    label: 'Approved',
    detail: `Payment approved — your subscription is running. ${REVIEW_PROMISE_COPY}`,
  },
  REJECTED: {
    label: 'Rejected',
    detail: `Payment rejected — the receipt was reviewed within 24 hours. Start a new payment attempt from the upgrade screen.`,
  },
  EXPIRED: {
    label: 'Expired',
    detail: `Expired before a receipt arrived — nothing entered the 24-hour review queue. You can start again at any time.`,
  },
}

/** Every PaymentStatus, in lifecycle order — used by exhaustiveness tests. */
export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_COPY) as PaymentStatus[]

/** The short label for a status ("Under review"). */
export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_COPY[status].label
}

/** The detail sentence for a status — always including the 24-hour promise. */
export function paymentStatusDetail(status: PaymentStatus): string {
  return PAYMENT_STATUS_COPY[status].detail
}
