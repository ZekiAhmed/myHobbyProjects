'use client'

/**
 * @fileoverview Persistent pending-review banner in the app shell
 * (subscription-billing issue 06)
 *
 * Spec stories 13/15/16: while a submission is under review the
 * subscriber is reminded of it wherever they are — the banner mounts in
 * the authenticated layout, directly under the nav — and the waiting
 * stays non-blocking: it is a static, informational region (role
 * "status"), never a modal, never an overlay, never a redirect, so every
 * free feature keeps working exactly as before (checklist: "No
 * navigation or free-feature behavior changes while pending").
 *
 * SCOPED TO THE ACTING USER: the read returns only their own payment
 * attempts, so a team Member never sees an Owner's pending review
 * (story 17) — with no attempt of their own, nothing renders.
 *
 * CALM BY DESIGN: loading and error states render nothing at all. A
 * billing outage must never break the app shell, and a banner that
 * flickers on every navigation is noise, not a promise kept.
 */

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { billingSubmissionsQueryOptions } from '@/lib/queries/board-keys'
import { paymentStatusDetail, paymentStatusLabel } from '@/lib/payment-status'

export function PendingReviewBanner() {
  const history = useQuery(billingSubmissionsQueryOptions())

  const pending = history.data?.submissions.find(
    (submission) => submission.status === 'PENDING'
  )

  // loading / error / nothing under review → the shell renders untouched
  if (!pending) return null

  return (
    <div
      role="status"
      data-testid="pending-review-banner"
      className="border-b bg-muted/40"
    >
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6">
        <p className="text-sm font-medium">{paymentStatusLabel(pending.status)}</p>
        <p className="min-w-0 text-sm text-muted-foreground">
          {paymentStatusDetail(pending.status)} Reference{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {pending.reference}
          </code>
        </p>
        <Link
          href="/billing"
          className="ml-auto shrink-0 text-sm font-medium underline underline-offset-4 transition-colors hover:text-foreground"
        >
          View billing history
        </Link>
      </div>
    </div>
  )
}
