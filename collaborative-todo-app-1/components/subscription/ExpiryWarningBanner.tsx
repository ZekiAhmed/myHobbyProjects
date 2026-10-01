/**
 * @fileoverview T-7 expiry warning banner in the app shell
 * (subscription-billing issue 11)
 *
 * Spec story 28: seven days before the paid period ends the subscriber
 * is warned in-app so they can renew without interruption — shown to the
 * SUBSCRIBER ONLY, never to a team Member. That scoping is structural:
 * the layout hands this component the signed-in user's own period end,
 * and a Member has none, so nothing renders for them (story 17's rule,
 * applied to the countdown).
 *
 * The date is the CLAMPED CALENDAR date from formatRenewalDate
 * (story 33: "renews 25 March", never a day counter that drifts with
 * short months), derived lazily from the period end — no cron, no
 * stored warning state (spec §Domain & entitlement).
 *
 * NON-BLOCKING by design: a static informational region under the nav,
 * never a modal, never a redirect — the warning informs, the renewal
 * link acts.
 *
 * Strip shell (structure, tone): components/StatusBanner.tsx
 */

import Link from 'next/link'
import { StatusBanner } from '@/components/StatusBanner'
import { deriveSubscription, formatRenewalDate } from '@/lib/subscription'

export function ExpiryWarningBanner({ periodEnd }: { periodEnd: Date | null }) {
  const { expiringSoon } = deriveSubscription(periodEnd, new Date())

  // never subscribed (a team Member), healthy period, or lapsed →
  // the shell renders untouched
  if (!periodEnd || !expiringSoon) return null

  return (
    <StatusBanner
      variant="strip"
      tone="warning"
      testId="expiry-warning-banner"
      label={
        <>
          Your Pro subscription renews {formatRenewalDate(periodEnd)}.
        </>
      }
      message={
        <>
          Renew early to stack another month onto your current period — no gap in
          service.
        </>
      }
      action={
        <Link
          href="/upgrade"
          className="ml-auto shrink-0 text-sm font-medium underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Extend by 1 month
        </Link>
      }
    />
  )
}
