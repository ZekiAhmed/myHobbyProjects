/**
 * @fileoverview Receipt file-signature detection (subscription-billing issue 05)
 *
 * Spec §Receipt storage: uploads are validated by the file's REAL MIME
 * signature (magic bytes) — never by the filename extension or the
 * browser-declared content type, both of which are trivially spoofable.
 * A plain-text file named receipt.png is rejected before any database
 * write happens.
 *
 * Accepted types (spec): image/jpeg, image/png, image/webp,
 * application/pdf — the formats banking apps actually export.
 *
 * The 5 MB cap lives here too so the route (authoritative) and the
 * upload form (fast feedback, story 9) quote the same number.
 */

/** 5 MB — the spec's hard cap (spec §Receipt storage). */
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024

/**
 * Rejection copy shared by the upload route (authoritative) and the
 * form (fast feedback) — the user must see the same words wherever the
 * same mistake is caught (spec user story 9).
 */
export const RECEIPT_TOO_LARGE_ERROR =
  'Receipt must be 5 MB or smaller — export a smaller screenshot or PDF'
export const RECEIPT_UNSUPPORTED_TYPE_ERROR =
  'Unsupported file type — upload a JPEG, PNG, WebP, or PDF receipt'

export type ReceiptMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

/** Exactly the four types the spec accepts, for error copy and accept attrs. */
export const RECEIPT_MIME_TYPES: readonly ReceiptMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

/** ASCII match against a byte prefix (e.g. "%PDF-"). */
function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  if (bytes.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix.charCodeAt(i)) return false
  }
  return true
}

/** Extension per accepted type — always derived from the sniffed type. */
const RECEIPT_EXTENSIONS: Record<ReceiptMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/**
 * The file extension for a stored receipt type — used for the
 * Content-Disposition filename on the admin viewer route
 * (subscription-billing issue 07), so a downloaded receipt keeps a name
 * the operating system recognises instead of the URL's last segment.
 *
 * Takes the raw column value (a plain `string` on the row, not the
 * union): a type outside the accepted four would otherwise crash the
 * viewer, and an unknown type deserves a neutral extension rather than
 * a 500 while an Administrator is mid-review.
 */
export function receiptFileExtension(mimeType: string): string {
  return RECEIPT_EXTENSIONS[mimeType as ReceiptMimeType] ?? 'bin'
}

/**
 * Sniffs the receipt's MIME type from its leading bytes.
 *
 * @returns The spec-accepted MIME type, or null when the bytes match
 *   none of the four signatures (text, HTML, truncated files, …) —
 *   the caller rejects null before touching the database.
 */
export function detectReceiptMimeType(bytes: Uint8Array): ReceiptMimeType | null {
  // JPEG: FF D8 FF (SOI marker + first marker byte)
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 8-byte signature 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length >= PNG.length && PNG.every((b, i) => bytes[i] === b)) {
    return 'image/png'
  }

  // WebP: RIFF container with WEBP form type at offset 8
  if (
    bytes.length >= 12 &&
    startsWithAscii(bytes.subarray(0, 4), 'RIFF') &&
    startsWithAscii(bytes.subarray(8, 12), 'WEBP')
  ) {
    return 'image/webp'
  }

  // PDF: %PDF- header
  if (startsWithAscii(bytes, '%PDF-')) {
    return 'application/pdf'
  }

  return null
}
