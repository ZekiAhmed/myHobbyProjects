'use client'

/**
 * @fileoverview Administrator review queue (subscription-billing issue 07)
 *
 * Rendered ONLY inside the /admin gate (requireAdmin) — and even there
 * every decision re-checks the platform role server-side (defense in
 * depth, same as RoleManager).
 *
 * WHAT A CARD CARRIES (spec story 36 + checklist):
 * - The aging badge ("18h left", "OVERDUE" past the 24-hour promise),
 *   recomputed from `updatedAt` on every render — the moment the
 *   receipt landed and the row entered the queue, which is when the
 *   promise starts. This is the app's one polling surface
 *   (adminReviewQueueQueryOptions, 60s), so a tab left open overnight
 *   keeps counting down honestly
 * - The expected amount as snapshotted at submission, the submitter's
 *   name + email, the submission time, and the payment reference
 * - The receipt, linked through the admin-gated viewer route — the
 *   image itself is never inlined here
 * - The fallback matching hint (amount + sender + transfer date from
 *   `createdAt`) that lets an Administrator approve a bank transfer
 *   that arrived WITHOUT the memo reference (checklist: approvable
 *   regardless of OCR/memo matching)
 *
 * DECISIONS flow through the server actions and the central query keys:
 * a success invalidates adminKeys.reviewQueue(), so the decided card
 * leaves the list, the count updates, and a refusal (ActionResult error,
 * including the terminal-state guard's "already been decided") is
 * surfaced through the house toast helpers (lib/toast.ts) — the list
 * keeps its pre-refusal state either way.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { adminKeys, adminReviewQueueQueryOptions } from '@/lib/queries/board-keys'
import { reviewAgeBadge } from '@/lib/review-aging'
import { formatRenewalDate } from '@/lib/subscription'
import { handleActionResult, handleMutationError, toast } from '@/lib/toast'
import { approveSubmission, rejectSubmission } from '@/actions/payment-review'
import type { ReviewQueueSubmission } from '@/lib/types'

function formatTimestamp(value: Date | string): string {
  return format(new Date(value), 'd MMM yyyy, HH:mm')
}

function isoTimestamp(value: Date | string): string {
  return new Date(value).toISOString()
}

interface ReviewCardProps {
  submission: ReviewQueueSubmission
  busy: boolean
  onApprove: (submissionId: string) => void
  onReject: (submissionId: string, reason: string) => void
}

function ReviewCard({ submission, busy, onApprove, onReject }: ReviewCardProps) {
  const [reason, setReason] = useState('')
  // The promise runs from queue entry — `updatedAt` on a pending row
  // is the receipt-landing instant, not the older instruction creation
  const age = reviewAgeBadge(new Date(submission.updatedAt), new Date())
  const receiptUrl = `/api/receipts?reference=${encodeURIComponent(submission.reference)}`

  return (
    <li data-testid="review-card" className="rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
          {submission.reference}
        </code>
        <span
          data-testid="aging-badge"
          aria-label={age.overdue ? 'Review window passed' : 'Time left to review'}
          className={
            age.overdue
              ? 'rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive'
              : 'rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground'
          }
        >
          {age.label}
        </span>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Expected</dt>
          <dd className="font-medium">
            {submission.priceSnapshot} {submission.currencySnapshot}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Submitted by</dt>
          <dd className="font-medium">{submission.user.name}</dd>
          <dd className="text-xs text-muted-foreground">{submission.user.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Submitted</dt>
          <dd>
            <time dateTime={isoTimestamp(submission.updatedAt)}>
              {formatTimestamp(submission.updatedAt)}
            </time>
          </dd>
        </div>
      </dl>

      {submission.receiptMimeType && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
        >
          View receipt ({submission.receiptMimeType})
        </a>
      )}

      <p className="mt-3 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
        No memo reference on the transfer? Approve by matching your bank
        statement on <span className="font-medium text-foreground">
          {submission.priceSnapshot} {submission.currencySnapshot}
        </span>{' '}
        from{' '}
        <span className="font-medium text-foreground">{submission.user.name}</span>{' '}
        around{' '}
        <span className="font-medium text-foreground">
          {format(new Date(submission.createdAt), 'd MMM yyyy')}
        </span>{' '}
        (when the transfer was initiated).
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={`rejection-reason-${submission.id}`}
            className="text-xs font-medium"
          >
            Rejection reason (required)
          </label>
          <Textarea
            id={`rejection-reason-${submission.id}`}
            rows={2}
            maxLength={500}
            value={reason}
            disabled={busy}
            placeholder="Amount mismatch — received 90 ETB, expected 250 ETB"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || reason.trim().length === 0}
            onClick={() => onReject(submission.id, reason)}
          >
            Reject
          </Button>
          <Button size="sm" disabled={busy} onClick={() => onApprove(submission.id)}>
            Approve
          </Button>
        </div>
      </div>
    </li>
  )
}

export function ReviewQueue() {
  const queryClient = useQueryClient()
  const queue = useQuery(adminReviewQueueQueryOptions())

  const approve = useMutation({
    mutationFn: (submissionId: string) => approveSubmission({ submissionId }),
    onSuccess: (result) =>
      handleActionResult(result, {
        silentSuccess: true,
        onSuccess: (data) => {
          // the period the payment bought, rendered as the same clamped
          // calendar date the subscriber's surfaces show (issue 11) —
          // "paid through 28 November", not a clock reading
          const paidThrough = formatRenewalDate(data.periodEnd)
          toast.success(`Payment approved — subscriber paid through ${paidThrough}`)
          queryClient.invalidateQueries({ queryKey: adminKeys.reviewQueue() })
        },
        onError: (error) => {
          // handleActionResult already toasts authorization/server; a
          // validation refusal (the terminal-state guard, an unknown
          // submission) would land in its silent branch, and a click
          // that visibly did nothing is exactly when an admin retries
          if (error.type === 'validation') toast.error(error.message)
        },
      }),
    onError: handleMutationError,
  })

  const reject = useMutation({
    mutationFn: (input: { submissionId: string; reason: string }) =>
      rejectSubmission(input),
    onSuccess: (result) =>
      handleActionResult(result, {
        successMessage: 'Payment rejected',
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: adminKeys.reviewQueue() })
        },
        onError: (error) => {
          if (error.type === 'validation') toast.error(error.message)
        },
      }),
    onError: handleMutationError,
  })

  const busyId = approve.isPending
    ? approve.variables
    : reject.isPending
      ? reject.variables.submissionId
      : null

  if (queue.isLoading) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="queue-loading">
        Loading review queue…
      </p>
    )
  }

  if (queue.isError) {
    return (
      <p
        role="alert"
        className="text-sm font-medium text-destructive"
        data-testid="queue-error"
      >
        Couldn&apos;t load the review queue — refresh the page to try again.
      </p>
    )
  }

  const submissions = queue.data?.submissions ?? []

  if (submissions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="queue-empty">
        No payments waiting for review.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {submissions.map((submission) => (
        <ReviewCard
          key={submission.id}
          submission={submission}
          busy={busyId === submission.id}
          onApprove={(submissionId) => approve.mutate(submissionId)}
          onReject={(submissionId, reason) => reject.mutate({ submissionId, reason })}
        />
      ))}
    </ul>
  )
}
