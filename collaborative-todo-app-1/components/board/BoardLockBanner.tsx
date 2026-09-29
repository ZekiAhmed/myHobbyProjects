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
 */

import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { BoardWriteLockReason } from '@/lib/subscription'

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

function promptFor(reason: BoardWriteLockReason): { label: string; href: string } {
  return reason === 'expired'
    ? { label: 'Renew Pro', href: '/upgrade' }
    : { label: 'Upgrade to Pro', href: '/upgrade' }
}

export function BoardLockBanner({ reason, isOwner }: BoardLockBannerProps) {
  const prompt = promptFor(reason)

  return (
    <div
      role="status"
      data-testid="board-lock-banner"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="flex min-w-0 items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900">{messageFor(reason, isOwner)}</p>
      </div>

      {isOwner && (
        <Link
          href={prompt.href}
          className="ml-auto inline-flex h-8 shrink-0 items-center justify-center rounded-[4px] border border-black bg-white px-4 text-sm font-medium tracking-[0.01em] text-black no-underline transition-[transform,background-color,color] duration-100 hover:bg-black hover:text-white active:translate-y-px"
        >
          {prompt.label}
        </Link>
      )}
    </div>
  )
}
