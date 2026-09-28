'use client'

/**
 * @fileoverview Billing history table (subscription-billing issue 06)
 *
 * Spec story 14: a durable record of every payment attempt with its
 * status, timestamps, amount, and reference — the answer to "did my
 * upload work, and what happened to it since?" Reads through the central
 * query options (GET /api/billing/submissions) so the table and the
 * dashboard's pending-review banner share one cache entry: after an
 * upload flips a row to PENDING, both surfaces update together.
 *
 * Every status's detail comes from lib/payment-status.ts, so each row
 * carries the 24-hour review promise verbatim (checklist), and the page
 * repeats the promise once as a footer note.
 *
 * Timestamps: the `datetime` attribute is the machine-readable contract;
 * the visible text uses the reader's local timezone, like every other
 * timestamp in the app.
 */

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { billingSubmissionsQueryOptions } from '@/lib/queries/board-keys'
import {
  REVIEW_PROMISE_COPY,
  paymentStatusDetail,
  paymentStatusLabel,
} from '@/lib/payment-status'
import type { BillingSubmission } from '@/lib/types'

function formatTimestamp(value: Date | string): string {
  return format(new Date(value), 'd MMM yyyy, HH:mm')
}

function isoTimestamp(value: Date | string): string {
  return new Date(value).toISOString()
}

function BillingRow({ submission }: { submission: BillingSubmission }) {
  return (
    <tr data-testid="billing-row" className="border-b last:border-b-0">
      <td className="px-4 py-3 align-top">
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
          {submission.reference}
        </code>
      </td>
      <td className="px-4 py-3 align-top font-medium">
        {submission.priceSnapshot} {submission.currencySnapshot}
      </td>
      <td className="px-4 py-3 align-top">
        <p className="font-medium">{paymentStatusLabel(submission.status)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {paymentStatusDetail(submission.status)}
        </p>
        {submission.status === 'AWAITING_UPLOAD' && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Expires {formatTimestamp(submission.expiresAt)}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <time dateTime={isoTimestamp(submission.createdAt)}>
          {formatTimestamp(submission.createdAt)}
        </time>
      </td>
      <td className="px-4 py-3 align-top">
        <time dateTime={isoTimestamp(submission.updatedAt)}>
          {formatTimestamp(submission.updatedAt)}
        </time>
      </td>
    </tr>
  )
}

export function BillingHistory() {
  const history = useQuery(billingSubmissionsQueryOptions())

  if (history.isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="billing-loading">
        Loading billing history…
      </p>
    )
  }

  if (history.isError) {
    return (
      <p role="alert" className="text-sm font-medium text-destructive" data-testid="billing-error">
        Couldn&apos;t load your billing history — refresh the page to try again.
      </p>
    )
  }

  const submissions = history.data?.submissions ?? []

  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No payment attempts yet</p>
        <p className="mt-1">
          When you start one from the Upgrade screen it appears here with its status,
          timestamps, amount, and reference. {REVIEW_PROMISE_COPY}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">
                Reference
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Amount
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Created
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Last updated
              </th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <BillingRow key={submission.id} submission={submission} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">{REVIEW_PROMISE_COPY}</p>
    </div>
  )
}
