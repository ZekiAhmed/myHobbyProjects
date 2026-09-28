/**
 * @fileoverview GET /api/admin/review-queue — the Administrator's
 * pending-payment queue (subscription-billing issue 07)
 *
 * The read behind the admin review queue: every submission sitting in
 * PENDING, longest-waiting first, so the 24-hour promise is honored
 * fairly (spec story 35). Each row carries the snapshot amount, the
 * submitter's identity, and the submission time — verification should
 * be a five-second match (story 39) — plus whether a receipt exists so
 * the card can offer the viewer.
 *
 * THE CLOCK: the promise runs from when the submission ENTERS the
 * queue — the receipt upload that flips the row to PENDING, which is
 * `updatedAt` on a pending row (nothing else touches it while it
 * waits) — NOT from `createdAt`, the payment-instruction creation. A
 * subscriber may upload within the instruction's 48-hour TTL, so
 * anchoring on `createdAt` would let a badge read OVERDUE before the
 * review window had even started (spec line 22: "Their submission
 * enters the review queue" at upload). The aging badge itself is
 * computed on the client from that same `updatedAt`
 * (lib/review-aging.ts), so a long-open tab keeps counting down
 * honestly. `createdAt` still rides along: it is when the transfer was
 * initiated, the date the bank-statement fallback hint matches on.
 *
 * AUTHORIZATION: defense in depth — the /admin page renders behind
 * requireAdmin(), and this handler re-checks the platform role itself,
 * answering with a 403 JSON body. A route handler cannot use
 * forbidden(), which is the page-level interrupt that renders the
 * 403 boundary; here the caller is a fetch, so it gets the status code.
 *
 * METADATA ONLY: `receiptBytes` is deliberately absent from the select
 * list — the blob is read only through the admin-gated viewer route
 * (GET /api/receipts), never shipped with the queue payload. `status`
 * is absent too: the WHERE already pins every row to PENDING, so
 * echoing it would be a constant on the wire.
 */

import { NextResponse } from 'next/server'
import { getRequiredSession, getPlatformRole } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await getRequiredSession()

  if ((await getPlatformRole(session.user.id)) !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { error: 'Only Administrators can review payments' },
      { status: 403 }
    )
  }

  const submissions = await prisma.paymentSubmission.findMany({
    // Only PENDING rows are visible to Administrators (spec §Payment
    // lifecycle): an awaiting attempt has no receipt yet, and decided /
    // expired rows are history for the subscriber, not work items.
    where: { status: 'PENDING' },
    // Longest waiting first — the same clock the aging badge counts
    // down from, so list order and badge order can't disagree
    // (spec story 35: honor the promise fairly).
    orderBy: { updatedAt: 'asc' },
    select: {
      id: true,
      reference: true,
      priceSnapshot: true,
      currencySnapshot: true,
      // presence + sniffed type only: tells the card whether a viewer
      // link exists without putting bytes on this wire
      receiptMimeType: true,
      // when the transfer was initiated — the hint's bank-statement date
      createdAt: true,
      // when the receipt landed and the row entered the queue — the
      // aging badge's anchor and the card's "submitted" time
      updatedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({ submissions })
}
