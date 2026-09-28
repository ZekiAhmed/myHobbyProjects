/**
 * @fileoverview POST /api/receipts — upload a transfer receipt
 * (subscription-billing issue 05)
 *
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
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { sendPaymentPendingEmail, type PaymentPendingEmailSubmission } from '@/lib/email'
import {
  detectReceiptMimeType,
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
