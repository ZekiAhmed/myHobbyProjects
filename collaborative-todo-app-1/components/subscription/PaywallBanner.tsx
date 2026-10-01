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
 * REASON WORDING comes from the shared UpgradePromptLink:
 * - "expired" — a Pro period ended; the Owner is offered renewal
 * - "none"    — no Pro period at all; the Owner is offered an upgrade
 *
 * NON-BLOCKING BY DESIGN: a static informational region (role
 * "status"), never a modal — the form underneath stays usable, so an
 * Owner who upgrades in another tab can simply try again.
 *
 * Card shell (structure, icon treatment): components/StatusBanner.tsx
 */

import { CreditCard } from 'lucide-react'
import type { NotProReason } from '@/lib/subscription'
import { StatusBanner } from '@/components/StatusBanner'
import { UpgradePromptLink } from '@/components/subscription/UpgradePromptLink'

interface PaywallBannerProps {
  /** Why the caller is not Pro — derived, never stored */
  reason: NotProReason
  /** The server's refusal message, shown verbatim */
  message: string
}

export function PaywallBanner({ reason, message }: PaywallBannerProps) {
  return (
    <StatusBanner
      variant="card"
      testId="paywall-banner"
      icon={CreditCard}
      message={message}
      action={<UpgradePromptLink reason={reason} />}
      className="mb-4"
    />
  )
}
