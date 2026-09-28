/**
 * @fileoverview Waiting-experience status card on the upgrade screen
 * (subscription-billing issue 06)
 *
 * The pay CTA's replacement while a submission is under review (spec
 * story 12): a calm, non-blocking card that says the upload worked, what
 * happens next, and the promised turnaround — "receipt submitted —
 * awaiting review, within 24 hours" (story 16).
 *
 * Presentational only: it takes the submission slice it renders and
 * reads its copy from lib/payment-status.ts, so the dashboard banner and
 * billing history say exactly the same words. No hooks — it renders in
 * the upgrade page's Server Component tree.
 */

import { paymentStatusDetail, paymentStatusLabel } from '@/lib/payment-status'
import type { PaymentSubmission } from '@/lib/generated/prisma/browser'

/** The slice of a submission this card renders (issue 05 card precedent). */
type PaymentStatusData = Pick<
  PaymentSubmission,
  'reference' | 'status' | 'priceSnapshot' | 'currencySnapshot'
>

interface PaymentStatusCardProps {
  submission: PaymentStatusData
}

export function PaymentStatusCard({ submission }: PaymentStatusCardProps) {
  return (
    <section
      className="rounded-lg border p-4"
      aria-labelledby="payment-status-heading"
      data-testid="payment-status-card"
    >
      <h2 id="payment-status-heading" className="font-semibold">
        {paymentStatusLabel(submission.status)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {paymentStatusDetail(submission.status)}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Payment reference</dt>
          <dd className="mt-0.5">
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
              {submission.reference}
            </code>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="mt-0.5 font-medium">
            {submission.priceSnapshot} {submission.currencySnapshot}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm text-muted-foreground">
        No further action needed — you will be notified of the decision, and everything else
        on this screen (and across the app) keeps working exactly as before.
      </p>
    </section>
  )
}
