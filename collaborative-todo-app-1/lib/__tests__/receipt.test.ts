/**
 * @fileoverview Contract tests for receipt file-signature detection
 * (subscription-billing issue 05)
 *
 * Spec §Receipt storage: the upload route accepts image/jpeg, image/png,
 * image/webp, application/pdf — determined from the file's real bytes
 * (magic numbers), NEVER from the filename extension or the client's
 * declared MIME type. A text file named .png must not pass.
 */

import { describe, it, expect } from 'vitest'
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
  detectReceiptMimeType,
} from '@/lib/receipt'

/** Byte prefix helper: ASCII prefix padded with arbitrary trailing bytes. */
function bytes(prefix: string | number[], length = 32): Uint8Array {
  const head = typeof prefix === 'string' ? [...prefix].map((c) => c.charCodeAt(0)) : prefix
  return Uint8Array.from({ length }, (_, i) => head[i] ?? 0)
}

describe('detectReceiptMimeType — accepted signatures', () => {
  it('recognises JPEG (FF D8 FF)', () => {
    expect(detectReceiptMimeType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
  })

  it('recognises PNG (8-byte magic number)', () => {
    expect(
      detectReceiptMimeType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe('image/png')
  })

  it('recognises WebP (RIFF....WEBP container)', () => {
    expect(detectReceiptMimeType(bytes('RIFF....WEBP'))).toBe('image/webp')
  })

  it('recognises PDF (%PDF- header)', () => {
    expect(detectReceiptMimeType(bytes('%PDF-1.7'))).toBe('application/pdf')
  })

  it('exposes exactly the four spec-accepted MIME types', () => {
    expect([...RECEIPT_MIME_TYPES].sort()).toEqual(
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].sort()
    )
  })
})

describe('detectReceiptMimeType — rejections', () => {
  it('rejects plain text pretending to be an image', () => {
    expect(detectReceiptMimeType(bytes('This is not a receipt'))).toBeNull()
  })

  it('rejects an HTML file', () => {
    expect(detectReceiptMimeType(bytes('<html><body>invoice</body></html>'))).toBeNull()
  })

  it('rejects an empty buffer', () => {
    expect(detectReceiptMimeType(new Uint8Array(0))).toBeNull()
  })

  it('rejects a near-miss PNG (right start, truncated before byte 8)', () => {
    expect(detectReceiptMimeType(bytes([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
  })
})

describe('RECEIPT_MAX_BYTES', () => {
  it('is 5 MB exactly as the spec caps it', () => {
    expect(RECEIPT_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})
