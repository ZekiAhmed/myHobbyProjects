/**
 * @fileoverview Shared shell for the two status banners in the app
 *
 * A single presentational component behind every static, informational
 * region surfaced under the nav or inside a card — paywall, board lock,
 * pending review, expiry warning. Two shapes:
 *
 * - "card"  — a rounded amber card with a leading icon and a trailing
 *             self-service action (PaywallBanner, BoardLockBanner)
 * - "strip" — a full-bleed border-bottom row under the nav: bold label,
 *             muted detail, trailing link (PendingReviewBanner,
 *             ExpiryWarningBanner)
 *
 * NON-BLOCKING BY DESIGN: every variant is a static informational
 * region (role "status"), never a modal, never an overlay — the surface
 * underneath stays usable. Keep it that way when adding a new banner.
 *
 * The shell owns ONLY structure and icon treatment; wording, data
 * fetching, and reason logic stay in each banner component.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface StatusBannerBase {
  /** Identifies the banner for tests and e2e hooks */
  testId: string
  /** The detail line: what the status means right now */
  message: ReactNode
  /** Trailing self-service action (link or button), rendered as-is */
  action?: ReactNode
  /** Extra classes for placement in context (e.g. `mb-4`) */
  className?: string
}

export interface CardStatusBanner extends StatusBannerBase {
  variant: 'card'
  /** Leading status icon, drawn at 16px in the banner's amber tone */
  icon: LucideIcon
}

export interface StripStatusBanner extends StatusBannerBase {
  variant: 'strip'
  /** warning = amber wash (expiring soon); neutral = muted wash (under review) */
  tone?: 'warning' | 'neutral'
  /** The bold leading line — the status name */
  label: ReactNode
}

export type StatusBannerProps = CardStatusBanner | StripStatusBanner

export function StatusBanner(props: StatusBannerProps) {
  const { variant, testId, message, action, className } = props
  const extra = className ? ` ${className}` : ''

  if (variant === 'card') {
    const Icon = props.icon
    return (
      <div
        role="status"
        data-testid={testId}
        className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3${extra}`}
      >
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-sm text-amber-900">{message}</p>
        </div>

        {action}
      </div>
    )
  }

  return (
    <div
      role="status"
      data-testid={testId}
      className={`border-b${props.tone === 'neutral' ? ' bg-muted/40' : ' bg-amber-500/10'}${extra}`}
    >
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 md:px-6">
        <p className="text-sm font-medium">{props.label}</p>
        <p className="min-w-0 text-sm text-muted-foreground">{message}</p>
        {action}
      </div>
    </div>
  )
}
