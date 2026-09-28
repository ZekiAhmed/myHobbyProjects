/**
 * @fileoverview Upgrade screen (Server Component)
 *
 * Route: /upgrade — where a free user starts a manual bank-transfer
 * payment attempt (subscription-billing issue 04).
 *
 * The screen reads the settings record as the single source of truth
 * for the live price/currency and bank details (spec §Money), plus the
 * signed-in user's one non-terminal attempt:
 * - live AWAITING_UPLOAD → the payment instruction card replaces the
 *   Subscribe CTA (reference, snapshotted amount, bank details)
 * - PENDING → the waiting-experience status card instead of the pay CTA
 *   (issue 06: canonical 24-hour promise copy, reference, amount — no
 *   further action, everything else on the screen unchanged)
 * - nothing / stale (48h TTL passed) → the Subscribe CTA. A stale row
 *   is NOT rendered as live and NOT flipped here — rendering never
 *   writes; the EXPIRED flip happens inside the subscribe action's
 *   transaction (issue 04).
 * A "View billing history" link is always present: the durable record of
 * every attempt (spec story 14) is one click away from any state.
 */

import Link from 'next/link'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getPricingSettings } from '@/lib/pricing-settings'
import { NON_TERMINAL_PAYMENT_STATUSES } from '@/lib/subscription'
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

  const now = new Date()
  const awaitingReceipt =
    openAttempt && openAttempt.status === 'AWAITING_UPLOAD' && openAttempt.expiresAt > now
      ? openAttempt
      : null
  const underReview =
    openAttempt && openAttempt.status === 'PENDING' ? openAttempt : null

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
