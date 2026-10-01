'use client'

/**
 * @fileoverview Read-only Board banner (subscription-billing issue 09)
 *
 * Spec stories 30/32: at expiry Boards that have Members become
 * read-only **for everyone** — visible, never deleted or hidden — while
 * the Owner's Board-less-Members Boards stay writable under the free
 * tier. This banner is the surface that says so.
 *
 * NON-BLOCKING BY DESIGN: it is a static informational region (role
 * "status"), never a modal and never a redirect — a locked Board is a
 * board you can still read (checklist: "No data is deleted or hidden").
 *
 * THE PROMPT IS THE OWNER'S: only the Owner can renew, so the
 * self-service link into /upgrade is shown to them alone (checklist:
 * "Lapsed state shows a self-service renew prompt on read-only
 * Boards"). A Member is told why editing stopped, without being handed
 * a purchase button they cannot use.
 *
 * REASON WORDING:
 * - "expired" — a Pro period ended; the Owner is offered renewal
 * - "none"    — no Pro period at all (the Board gained Members without
 *               one); the Owner is offered an upgrade instead
 * Both CTAs come from the shared UpgradePromptLink, worded the same
 * way as every other paywall surface (subscription-billing issue 10).
 *
 * Card shell (structure, icon treatment): components/StatusBanner.tsx
 */

import { Lock } from 'lucide-react'
import type { BoardWriteLockReason } from '@/lib/subscription'
import { StatusBanner } from '@/components/StatusBanner'
import { UpgradePromptLink } from '@/components/subscription/UpgradePromptLink'

interface BoardLockBannerProps {
  /** Why the Board is locked — derived, never stored (issue 09) */
  reason: BoardWriteLockReason
  /** Board Owner — the only one who can buy the unlock */
  isOwner: boolean
}

function messageFor(reason: BoardWriteLockReason, isOwner: boolean): string {
  if (reason === 'expired') {
    return isOwner
      ? "This board is read-only — your Pro subscription has expired. Renew to restore editing for everyone on this board."
      : "This board is read-only — the Owner's Pro subscription has expired, so editing is paused until they renew."
  }
  return isOwner
    ? 'This board is read-only — boards with Members need an active Pro subscription.'
    : 'This board is read-only — this board needs an active Pro subscription before anyone can edit.'
}

export function BoardLockBanner({ reason, isOwner }: BoardLockBannerProps) {
  return (
    <StatusBanner
      variant="card"
      testId="board-lock-banner"
      icon={Lock}
      message={messageFor(reason, isOwner)}
      action={isOwner ? <UpgradePromptLink reason={reason} /> : undefined}
    />
  )
}
