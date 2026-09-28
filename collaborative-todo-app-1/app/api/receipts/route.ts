/**
 * @fileoverview /api/receipts — the transfer receipt's two doors
 * (subscription-billing issues 05 + 07)
 *
 * POST /api/receipts — upload a transfer receipt.
 * Why an API route handler and not a server action (spec §Receipt
 * storage): the framework's server-action body-size limits are below
 * the spec's 5 MB receipt cap; a route handler reads the raw multipart
 * body itself.
 *
 * Validation order matters: size and file signature are checked from
 * the bytes BEFORE any database read or write (checklist: oversized and
 * spoofed files rejected before any database write), and the type is
 * decided by magic-byte sniffing (lib/receipt.ts) — never by the
 * filename or the browser-declared content type.
 *
 * The transition AWAITING_UPLOAD → PENDING is a single guarded write:
 * findUnique resolves the attempt (404 unknown / not yours), then
 * updateMany carries `status: AWAITING_UPLOAD` in its WHERE so a second
 * concurrent upload (or any stale tab) loses the race cleanly with 409 —
 * bytes and status flip land in the same statement (atomic).
 *
 * Administrator email is best-effort (spec §Administrator
 * notification): one fire-and-forget email per Administrator, logged on
 * failure — an email outage must never fail the user's upload.
 *
 * GET /api/receipts?reference=… — the Administrator's receipt viewer
 * (spec story 38). Same bytes, opposite direction: an authenticated,
 * Administrator-only route that streams the stored file back with its
 * sniffed content type so the review card can show the proof. A
 * non-Administrator is refused with 403 before the row is read —
 * receipt bytes are financial evidence, never part of a regular user's
 * session (the billing history route deliberately omits them).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession, getPlatformRole } from '@/lib/session'
import { prisma } from '@/lib/db'
import { sendPaymentPendingEmail, type PaymentPendingEmailSubmission } from '@/lib/email'
import {
  detectReceiptMimeType,
  receiptFileExtension,
  RECEIPT_MAX_BYTES,
  RECEIPT_TOO_LARGE_ERROR,
  RECEIPT_UNSUPPORTED_TYPE_ERROR,
} from '@/lib/receipt'

export async function POST(request: NextRequest) {
  const session = await getRequiredSession()

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form upload' }, { status: 400 })
  }

  const file = form.get('file')
  const reference = form.get('reference')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A receipt file is required' }, { status: 400 })
  }
  if (typeof reference !== 'string' || reference.length === 0) {
    return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 })
  }

  // size check first — cheap, and never touches the database
  if (file.size > RECEIPT_MAX_BYTES) {
    return NextResponse.json({ error: RECEIPT_TOO_LARGE_ERROR }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectReceiptMimeType(bytes)
  if (!mimeType) {
    return NextResponse.json({ error: RECEIPT_UNSUPPORTED_TYPE_ERROR }, { status: 415 })
  }

  const existing = await prisma.paymentSubmission.findUnique({ where: { reference } })
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Payment attempt not found' }, { status: 404 })
  }
  if (existing.status !== 'AWAITING_UPLOAD') {
    return NextResponse.json(
      { error: 'This payment attempt is no longer accepting uploads' },
      { status: 409 }
    )
  }
  if (existing.expiresAt <= new Date()) {
    // the 48h TTL bounds the awaiting window (spec §Payment lifecycle);
    // a stale open tab must not revive an expired attempt. The EXPIRED
    // flip stays owned by the subscribe action's transaction — this
    // route only refuses.
    return NextResponse.json(
      { error: 'This payment attempt has expired — start a new payment attempt to upload a receipt' },
      { status: 409 }
    )
  }

  const updated = await prisma.paymentSubmission.updateMany({
    // the status guard makes bytes + flip one atomic statement; a racing
    // second upload matches no row and surfaces as count 0 → 409
    where: { id: existing.id, status: 'AWAITING_UPLOAD' },
    data: { status: 'PENDING', receiptBytes: bytes, receiptMimeType: mimeType },
  })
  if (updated.count === 0) {
    return NextResponse.json(
      { error: 'This payment attempt is no longer accepting uploads' },
      { status: 409 }
    )
  }

  // Best-effort, fire-and-forget (spec §Administrator notification):
  // intentionally NOT awaited — the 200 is already decided, and any
  // failure below is logged, never surfaced as an upload error.
  void notifyAdministrators({
    reference,
    price: existing.priceSnapshot,
    currency: existing.currencySnapshot,
    submitterName: session.user.name ?? 'A user',
    submitterEmail: session.user.email,
  }).catch((error) => {
    console.error('[receipts] failed to notify administrators about a pending payment', error)
  })

  return NextResponse.json({ ok: true, status: 'PENDING' })
}

/**
 * GET /api/receipts?reference=… — stream one stored receipt back to an
 * Administrator (subscription-billing issue 07).
 *
 * AUTHORIZATION: the platform role is re-checked here, not inherited
 * from the page gate — a receipt is reachable from the review card by
 * URL, so this route is its own boundary. 403 comes before the row is
 * read, so a non-Administrator learns nothing, not even whether the
 * reference exists (the POST path answers unknown references with 404
 * to their owner; this path must not leak that to anyone else).
 *
 * The sniffed `receiptMimeType` written at upload time is what the
 * response carries — the stored bytes were validated by signature, so
 * rendering them under that type is safe. `private, no-store` keeps the
 * evidence out of every shared cache.
 */
export async function GET(request: NextRequest) {
  const session = await getRequiredSession()

  if ((await getPlatformRole(session.user.id)) !== 'ADMINISTRATOR') {
    return NextResponse.json(
      { error: 'Only Administrators can view receipts' },
      { status: 403 }
    )
  }

  const reference = request.nextUrl.searchParams.get('reference')
  if (!reference) {
    return NextResponse.json({ error: 'A payment reference is required' }, { status: 400 })
  }

  const submission = await prisma.paymentSubmission.findUnique({
    where: { reference },
    select: { reference: true, receiptBytes: true, receiptMimeType: true },
  })

  if (!submission || !submission.receiptBytes || !submission.receiptMimeType) {
    // no receipt yet (still AWAITING_UPLOAD) or bytes already pruned by
    // the 30-day retention rule (issue 12) — either way there is nothing
    // to view, and the queue only offers the link when a type exists
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
  }

  return new NextResponse(submission.receiptBytes, {
    headers: {
      'Content-Type': submission.receiptMimeType,
      'Content-Disposition': `inline; filename="receipt-${submission.reference}.${receiptFileExtension(
        submission.receiptMimeType
      )}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

/**
 * Fans one new-PENDING notification out to every Administrator.
 * Per-send failures are logged here; lookup failure propagates to the
 * caller's catch — both are logged, neither rejects the upload.
 */
async function notifyAdministrators(submission: PaymentPendingEmailSubmission) {
  const administrators = await prisma.user.findMany({
    where: { role: 'ADMINISTRATOR' },
    select: { email: true, name: true },
  })

  const results = await Promise.allSettled(
    administrators.map((admin) => sendPaymentPendingEmail(admin, submission))
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[receipts] payment-pending email failed', result.reason)
    }
  }
}
