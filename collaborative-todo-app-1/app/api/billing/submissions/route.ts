/**
 * @fileoverview GET /api/billing/submissions — the acting user's billing
 * history (subscription-billing issue 06)
 *
 * The read behind two surfaces: the dashboard's pending-review banner
 * ("is anything of mine under review?") and the billing history page
 * (story 14 — every attempt with status, timestamps, amount, and
 * reference). One endpoint serves both, so a single query-key entry
 * keeps them in sync.
 *
 * SCOPING: self-only. A payment submission is private financial history
 * of the subscriber — there is no cross-user or board-scoped view, and a
 * team Member's own list can never contain an Owner's attempt (story 17).
 *
 * METADATA ONLY: the select list deliberately omits `receiptBytes` —
 * receipt blobs are read only through the admin-gated file route (issue
 * 07), never on this path. `rejectionReason` IS selected (issue 08,
 * story 19): the stored reason is displayed back to its owner next to
 * the attempt. Newest-first so the live attempt sits at the
 * top of the history page.
 *
 * LAZY RETENTION (issue 12, story 50): this read doubles as the
 * opportunistic prune trigger — receipt bytes whose decision is 30+
 * days old are nulled on the way past, since this project has no cron
 * by design. The sweep is deliberately NOT user-scoped: retention is
 * operator hygiene, and an expired receipt must go even if its owner
 * never returns (it matches only decided rows, so it can never race a
 * live attempt or the review queue). It writes `receiptBytes` alone —
 * the audit metadata this route serves is untouched, so history stays
 * fully readable after a prune. Isolated in try/catch: a prune failure
 * is logged and this read still answers.
 */

import { NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { pruneExpiredReceipts } from '@/lib/receipt-retention'

export async function GET() {
  const session = await getRequiredSession()

  const submissions = await prisma.paymentSubmission.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      reference: true,
      status: true,
      priceSnapshot: true,
      currencySnapshot: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
      rejectionReason: true,
    },
  })

  // Opportunistic retention, AFTER the read this route exists for: the
  // history above is already computed, so even a failing sweep cannot
  // cost the subscriber their page (checklist: pruning failures never
  // break the reads that trigger them).
  try {
    await pruneExpiredReceipts()
  } catch (error) {
    console.error('[billing] receipt retention prune failed', error)
  }

  return NextResponse.json({ submissions })
}
