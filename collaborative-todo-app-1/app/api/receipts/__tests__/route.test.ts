/**
 * @fileoverview Server-entrypoint tests for the receipt upload route
 * (subscription-billing issue 05)
 *
 * CONTRACT UNDER TEST (POST /api/receipts):
 * 1. Accepts only the four spec MIME types — determined by real file
 *    signature, never the declared type or filename (spec §Receipt storage)
 * 2. Rejects >5 MB and spoofed files BEFORE any database access
 * 3. Success stores bytes + sniffed mime type and flips
 *    AWAITING_UPLOAD → PENDING in one guarded write (atomic)
 * 4. Unknown / other-user reference → 404; wrong state → 409
 * 5. Each new PENDING fires a best-effort email per Administrator;
 *    email failure is logged and never fails the upload
 *
 * External behavior only — session, db, and email mocked at the module
 * boundary per spec §Testing Decisions (prior art:
 * app/api/notifications/__tests__/route.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
}))
const emailMock = vi.hoisted(() => ({ sendPaymentPendingEmail: vi.fn() }))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email', () => emailMock)

import { POST as uploadReceipt } from '@/app/api/receipts/route'
import { RECEIPT_MAX_BYTES } from '@/lib/receipt'

const USER_ID = 'user_subscriber'
const REFERENCE = 'PAY-ABCD-1234'

const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const TEXT_BYTES = new TextEncoder().encode('Totally a receipt, trust me')

function signIn(userId = USER_ID) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Sub User' },
    session: { id: 's1' },
  })
}

function awaitingSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    userId: USER_ID,
    reference: REFERENCE,
    status: 'AWAITING_UPLOAD',
    priceSnapshot: 250,
    currencySnapshot: 'ETB',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    receiptBytes: null,
    receiptMimeType: null,
    ...overrides,
  }
}

function uploadRequest(options: { file?: File; reference?: string | null } = {}) {
  const form = new FormData()
  if (options.file) form.append('file', options.file)
  if (options.reference !== undefined && options.reference !== null) {
    form.append('reference', options.reference)
  }
  return new NextRequest('http://localhost/api/receipts', { method: 'POST', body: form })
}

function jpegFile(name = 'receipt.jpg', declaredType = 'image/jpeg') {
  return new File([JPEG_BYTES], name, { type: declaredType })
}

function textFile(name = 'receipt.png') {
  return new File([TEXT_BYTES], name, { type: 'image/png' })
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  signIn()
  prismaMock.paymentSubmission.findUnique.mockResolvedValue(awaitingSubmission())
  prismaMock.paymentSubmission.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findMany.mockResolvedValue([
    { email: 'admin1@t.dev', name: 'Admin One' },
    { email: 'admin2@t.dev', name: 'Admin Two' },
  ])
  emailMock.sendPaymentPendingEmail.mockResolvedValue({ id: 'email_1' })
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('POST /api/receipts — file validation (before any database access)', () => {
  it('accepts a real JPEG even when the client lies about its type', async () => {
    const res = await uploadReceipt(
      uploadRequest({ file: jpegFile('receipt.jpg', 'image/jpeg'), reference: REFERENCE })
    )

    expect(res.status).toBe(200)
    const { where, data } = prismaMock.paymentSubmission.updateMany.mock.calls[0][0]
    expect(where).toEqual({ id: 'sub_1', status: 'AWAITING_UPLOAD' })
    expect(data).toMatchObject({ status: 'PENDING', receiptMimeType: 'image/jpeg' })
    expect(data.receiptBytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(data.receiptBytes)).toEqual(Array.from(JPEG_BYTES))
  })

  it('rejects a spoofed text file wearing a .png name with 415 and no database access', async () => {
    const res = await uploadReceipt(uploadRequest({ file: textFile(), reference: REFERENCE }))

    expect(res.status).toBe(415)
    expect(prismaMock.paymentSubmission.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
  })

  it('rejects a file over 5 MB with 400 and no database access', async () => {
    const oversize = new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], 'huge.pdf', {
      type: 'application/pdf',
    })

    const res = await uploadReceipt(uploadRequest({ file: oversize, reference: REFERENCE }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/5 MB/)
    expect(prismaMock.paymentSubmission.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a request with no file with 400', async () => {
    const res = await uploadReceipt(uploadRequest({ reference: REFERENCE }))

    expect(res.status).toBe(400)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })

  it('rejects a request with no reference with 400', async () => {
    const res = await uploadReceipt(uploadRequest({ file: jpegFile() }))

    expect(res.status).toBe(400)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/receipts — transition guards', () => {
  it('returns 404 for an unknown reference', async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue(null)

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: 'PAY-ZZZZ-9999' }))

    expect(res.status).toBe(404)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
  })

  it("returns 404 for another user's reference — it must not resolve", async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue(
      awaitingSubmission({ userId: 'user_someone_else' })
    )

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(404)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
  })

  it('returns 409 when the attempt is already PENDING (double upload, stale tab)', async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue(
      awaitingSubmission({ status: 'PENDING' })
    )

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(409)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
  })

  it('returns 409 when the 48h TTL has passed — a stale tab cannot revive an expired attempt', async () => {
    prismaMock.paymentSubmission.findUnique.mockResolvedValue(
      awaitingSubmission({ expiresAt: new Date(Date.now() - 60 * 1000) })
    )

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
    expect(prismaMock.paymentSubmission.updateMany).not.toHaveBeenCalled()
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
  })

  it('returns 409 when the guarded write loses a race (another request won)', async () => {
    prismaMock.paymentSubmission.updateMany.mockResolvedValue({ count: 0 })

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(409)
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/receipts — best-effort Administrator email', () => {
  it('emails every Administrator exactly once, with the reference and amount', async () => {
    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(emailMock.sendPaymentPendingEmail).toHaveBeenCalledTimes(2)
    )
    const recipients = emailMock.sendPaymentPendingEmail.mock.calls.map(
      ([admin]) => admin.email
    )
    expect(recipients.sort()).toEqual(['admin1@t.dev', 'admin2@t.dev'])
    expect(emailMock.sendPaymentPendingEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin1@t.dev' }),
      expect.objectContaining({
        reference: REFERENCE,
        price: 250,
        currency: 'ETB',
        submitterEmail: 'user_subscriber@t.dev',
      })
    )
  })

  it('never fails the upload when an email blows up — 200 stays 200, failure is logged', async () => {
    emailMock.sendPaymentPendingEmail.mockRejectedValue(new Error('resend is down'))

    const res = await uploadReceipt(uploadRequest({ file: jpegFile(), reference: REFERENCE }))

    expect(res.status).toBe(200)
    await vi.waitFor(() =>
      expect(emailMock.sendPaymentPendingEmail).toHaveBeenCalledTimes(2)
    )
    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
    const logged = errorSpy.mock.calls
      .map((args: unknown[]) => String(args[0]))
      .join(' ')
    expect(logged).toMatch(/email/i)
  })

  it('does not notify when the upload was rejected', async () => {
    const res = await uploadReceipt(uploadRequest({ file: textFile(), reference: REFERENCE }))

    expect(res.status).toBe(415)
    await new Promise((r) => setTimeout(r, 0))
    expect(emailMock.sendPaymentPendingEmail).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })
})
