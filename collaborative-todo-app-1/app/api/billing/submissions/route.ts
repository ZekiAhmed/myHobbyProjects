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
 * 07), never on this path. Newest-first so the live attempt sits at the
 * top of the history page.
 */

import { NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

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
    },
  })

  return NextResponse.json({ submissions })
}
