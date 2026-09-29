'use client'

/**
 * @fileoverview Paywall prompt shown AT the paid moment
 * (subscription-billing issue 10)
 *
 * Spec story 25: a free Owner meets the paywall exactly when they try
 * to invite a Member — never before, never somewhere else. This is
 * that surface: the server's refusal message plus the self-service
 * prompt for WHY they are not Pro.
 *
 * REASON WORDING (mirrors BoardLockBanner's promptFor):
 * - "expired" — a Pro period ended; the Owner is offered renewal
 * - "none"    — no Pro period at all; the Owner is offered an upgrade
 *
 * NON-BLOCKING BY DESIGN: a static informational region (role
 * "status"), never a modal — the form underneath stays usable, so an
 * Owner who upgrades in another tab can simply try again.
 */

import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import type { NotProReason } from '@/lib/subscription'

const CTA_LABELS: Record<NotProReason, string> = {
  expired: 'Renew Pro',
  none: 'Upgrade to Pro',
}

interface PaywallBannerProps {
  /** Why the caller is not Pro — derived, never stored */
  reason: NotProReason
  /** The server's refusal message, shown verbatim */
  message: string
}

export function PaywallBanner({ reason, message }: PaywallBannerProps) {
  return (
    <div
      role="status"
      data-testid="paywall-banner"
      className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900">{message}</p>
      </div>

      <Link
        href="/upgrade"
        className="ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-[4px] border border-black bg-white px-4 text-sm font-medium tracking-[0.01em] text-black no-underline transition-[transform,background-color,color] duration-100 hover:bg-black hover:text-white active:translate-y-px"
      >
        {CTA_LABELS[reason]}
      </Link>
    </div>
  )
}
