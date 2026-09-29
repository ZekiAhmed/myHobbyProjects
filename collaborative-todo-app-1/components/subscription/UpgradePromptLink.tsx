'use client'

/**
 * @fileoverview The self-service CTA every paywall surface shares
 *
 * One map, one link: a not-Pro state implies exactly one prompt — a
 * lapsed subscriber is offered renewal, a never-subscribed one an
 * upgrade — both landing on /upgrade, where the screen words itself
 * accordingly. BoardLockBanner (issue 09) and PaywallBanner (issue 10)
 * both render this, so the reason → wording pairing can never drift
 * between the two surfaces.
 */

import Link from 'next/link'
import type { NotProReason } from '@/lib/subscription'

function promptFor(reason: NotProReason): { label: string; href: string } {
  return reason === 'expired'
    ? { label: 'Renew Pro', href: '/upgrade' }
    : { label: 'Upgrade to Pro', href: '/upgrade' }
}

interface UpgradePromptLinkProps {
  /** Why the viewer is not Pro — derived, never stored */
  reason: NotProReason
}

export function UpgradePromptLink({ reason }: UpgradePromptLinkProps) {
  const prompt = promptFor(reason)

  return (
    <Link
      href={prompt.href}
      className="ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-[4px] border border-black bg-white px-4 text-sm font-medium tracking-[0.01em] text-black no-underline transition-[transform,background-color,color] duration-100 hover:bg-black hover:text-white active:translate-y-px"
    >
      {prompt.label}
    </Link>
  )
}
