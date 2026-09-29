/**
 * @fileoverview Upgrade screen (Server Component)
 *
 * Route: /upgrade — where a free user starts a manual bank-transfer
 * payment attempt (subscription-billing issue 04), and where an active
 * subscriber renews early (issue 11).
 *
 * The screen reads the settings record as the single source of truth
 * for the live price/currency and bank details (spec §Money), plus the
 * signed-in user's one non-terminal attempt and their period end:
 * - live AWAITING_UPLOAD → the payment instruction card replaces the
 *   Subscribe CTA (reference, snapshotted amount, bank details)
 * - PENDING → the waiting-experience status card instead of the pay CTA
 *   (issue 06: canonical 24-hour promise copy, reference, amount — no
 *   further action, everything else on the screen unchanged)
 * - nothing / stale (48h TTL passed) → the pay CTA, whose LABEL follows
 *   entitlement (issue 11): "Extend by 1 month" while Pro is active
 *   (with the clamped CALENDAR renewal date — spec story 33), the plain
 *   Subscribe once the period has lapsed or never started. Same action
 *   behind both: an approved renewal stacks onto the current period end
 *   (issue 07), so extending is a Subscribe that stacks.
 * A "View billing history" link is always present: the durable record of
 * every attempt (spec story 14) is one click away from any state.
 */

import Link from 'next/link'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getPricingSettings } from '@/lib/pricing-settings'
import {
  formatRenewalDate,
  isProSubscriber,
  NON_TERMINAL_PAYMENT_STATUSES,
} from '@/lib/subscription'
import { PageShell } from '@/components/PageShell'
import { SubscribeButton } from '@/components/subscription/SubscribeButton'
import { PaymentInstructionCard } from '@/components/subscription/PaymentInstructionCard'
import { PaymentStatusCard } from '@/components/subscription/PaymentStatusCard'

export default async function UpgradePage() {
  const session = await getRequiredSession()

  const settings = await getPricingSettings()
  const openAttempt = await prisma.paymentSubmission.findFirst({
    where: { userId: session.user.id, status: { in: NON_TERMINAL_PAYMENT_STATUSES } },
    orderBy: { createdAt: 'desc' },
  })
  const subscriber = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionPeriodEnd: true },
  })

  const now = new Date()
  const awaitingReceipt =
    openAttempt && openAttempt.status === 'AWAITING_UPLOAD' && openAttempt.expiresAt > now
      ? openAttempt
      : null
  const underReview =
    openAttempt && openAttempt.status === 'PENDING' ? openAttempt : null

  // entitlement drives the CTA: while Pro is running the screen offers
  // an extension against its own calendar renewal date; otherwise the
  // plain Subscribe. `renewal` is non-null exactly when the period is
  // active (isProSubscriber answers the boolean, formatRenewalDate the
  // date, so label and date can never disagree).
  // The attempt cards above still win while one is live (one attempt at
  // a time).
  const periodEnd = subscriber?.subscriptionPeriodEnd ?? null
  const renewal =
    periodEnd !== null && isProSubscriber(periodEnd, now) ? formatRenewalDate(periodEnd) : null

  return (
    <PageShell title="Upgrade to Pro" narrow>
      <div className="space-y-4">
        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">One subscription, your whole team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite Members to any Board you own — they join free, only you pay. Your personal
            Boards stay unlimited either way.
          </p>
          <p className="mt-3 text-2xl font-bold">
            {settings.price} {settings.currency}
            <span className="text-sm font-normal text-muted-foreground"> / month</span>
          </p>
        </section>

        {awaitingReceipt ? (
          <PaymentInstructionCard submission={awaitingReceipt} settings={settings} />
        ) : underReview ? (
          <PaymentStatusCard submission={underReview} />
        ) : renewal ? (
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Extend your subscription</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your subscription renews {renewal}. Extending stacks another month onto your
              current period — no gap in service. Receipts are reviewed within 24 hours.
            </p>
            <div className="mt-3">
              <SubscribeButton label="Extend by 1 month" />
            </div>
          </section>
        ) : (
          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Start a payment attempt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You will receive a unique payment reference and our bank details to transfer the
              amount above. Receipts are reviewed within 24 hours.
            </p>
            <div className="mt-3">
              <SubscribeButton />
            </div>
          </section>
        )}

        <p className="text-sm text-muted-foreground">
          <Link
            href="/billing"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            View billing history
          </Link>
        </p>
      </div>
    </PageShell>
  )
}
