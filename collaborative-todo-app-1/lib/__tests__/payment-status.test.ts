/**
 * @fileoverview Status-copy tests for the waiting experience
 * (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (lib/payment-status.ts):
 * 1. Every PaymentStatus has a non-empty label and detail
 * 2. Every status's detail carries the 24-hour review promise
 *    (checklist: "All statuses shown include the 24-hour review promise
 *    copy") — one helper, so the card, the banner, and billing history
 *    can never drift apart
 * 3. The PENDING detail is worded exactly as the ticket words it:
 *    "receipt submitted — awaiting review, within 24 hours"
 * 4. The helper covers the whole spec §Payment lifecycle status set
 *
 * Pure functions — supporting seam (spec §Testing Decisions, prior art:
 * lib/__tests__/subscription.test.ts).
 */

import { describe, it, expect } from 'vitest'
import type { PaymentStatus } from '@/lib/generated/prisma/browser'
import {
  PAYMENT_STATUSES,
  REVIEW_PROMISE_COPY,
  paymentStatusDetail,
  paymentStatusLabel,
} from '@/lib/payment-status'

/** The five statuses of the spec's payment lifecycle, as literals. */
const SPEC_STATUSES: PaymentStatus[] = [
  'AWAITING_UPLOAD',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]

describe('payment status copy — coverage', () => {
  it('covers exactly the spec payment lifecycle statuses', () => {
    expect([...PAYMENT_STATUSES].sort()).toEqual([...SPEC_STATUSES].sort())
  })

  it.each(SPEC_STATUSES)('has a non-empty label for %s', (status) => {
    expect(paymentStatusLabel(status).trim().length).toBeGreaterThan(0)
  })

  it.each(SPEC_STATUSES)('has a non-empty detail for %s', (status) => {
    expect(paymentStatusDetail(status).trim().length).toBeGreaterThan(0)
  })
})

describe('payment status copy — the 24-hour promise travels with every status', () => {
  it.each(SPEC_STATUSES)('shows the 24-hour review promise for %s', (status) => {
    // both phrasings count: "within 24 hours" and the hyphenated
    // "24-hour review queue" wording
    expect(paymentStatusDetail(status)).toMatch(/24[-\s]hour/i)
  })

  it('uses the shared promise sentence verbatim on the awaiting-upload state', () => {
    expect(REVIEW_PROMISE_COPY).toBe('Receipts are reviewed within 24 hours.')
    expect(paymentStatusDetail('AWAITING_UPLOAD')).toContain(REVIEW_PROMISE_COPY)
  })

  it('words the under-review state exactly as the waiting-experience ticket does', () => {
    expect(paymentStatusLabel('PENDING')).toBe('Under review')
    expect(paymentStatusDetail('PENDING')).toBe(
      'Receipt submitted — awaiting review, within 24 hours.'
    )
  })
})
