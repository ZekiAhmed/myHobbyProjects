// @vitest-environment jsdom
/**
 * @fileoverview Receipt upload form tests (subscription-billing issue 05)
 *
 * CONTRACT UNDER TEST:
 * 1. The memo-confirmation checkbox precedes upload — the submit button
 *    is dead until it is ticked (the reference-in-memo attestation)
 * 2. Oversize files get a clear, immediate validation error without a
 *    network round-trip (story 9)
 * 3. A successful upload shows a definitive "submitted, under review"
 *    success state and refreshes the screen (story 11)
 * 4. A server rejection surfaces its message inline and keeps the form
 *
 * jsdom environment — prior art:
 * components/subscription/__tests__/SubscribeButton.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const refreshMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

import { ReceiptUploadForm } from '@/components/subscription/ReceiptUploadForm'
import { RECEIPT_MAX_BYTES } from '@/lib/receipt'

const REFERENCE = 'PAY-ABCD-1234'
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

let container: HTMLDivElement
let root: Root | undefined

async function render() {
  root = createRoot(container)
  await act(async () => {
    root!.render(<ReceiptUploadForm reference={REFERENCE} />)
  })
}

function setInputFiles(file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  act(() => {
    // jsdom has no FileList constructor — the form only reads
    // target.files[0], so an instance property is enough
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function checkbox(): HTMLInputElement {
  return container.querySelector('input[type="checkbox"]') as HTMLInputElement
}

function submitButton(): HTMLButtonElement {
  return container.querySelector('button[type="submit"]') as HTMLButtonElement
}

async function tick() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, status: 'PENDING' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  )
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
  vi.unstubAllGlobals()
})

describe('ReceiptUploadForm — memo checkbox precedes upload', () => {
  it('keeps submit disabled until the memo checkbox is ticked', async () => {
    await render()
    setInputFiles(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'r.jpg', { type: 'image/jpeg' }))

    expect(submitButton().disabled).toBe(true)

    await act(async () => {
      checkbox().click()
    })

    expect(submitButton().disabled).toBe(false)
  })
})

describe('ReceiptUploadForm — client-side size validation (story 9)', () => {
  it('rejects a >5 MB file immediately with a clear message and no network call', async () => {
    await render()
    await act(async () => {
      checkbox().click()
    })
    setInputFiles(new File([new Uint8Array(RECEIPT_MAX_BYTES + 1)], 'huge.pdf', {
      type: 'application/pdf',
    }))

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('5 MB')
    // status feedback goes through the shared toast helpers too
    // (spec §Conventions), alongside the inline fix-it message
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][0]).toMatch(/5 MB/)
  })
})

describe('ReceiptUploadForm — success screen (story 11)', () => {
  it('shows a definitive submitted / under-review state and refreshes the screen', async () => {
    await render()
    setInputFiles(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'r.jpg', { type: 'image/jpeg' }))
    await act(async () => {
      checkbox().click()
    })

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
      await Promise.resolve()
    })
    await tick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/receipts')
    expect(init?.method).toBe('POST')
    expect(container.textContent).toContain('submitted')
    expect(container.textContent).toContain('under review')
    expect(container.textContent).toContain(REFERENCE)
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledTimes(1)
  })
})

describe('ReceiptUploadForm — server rejection stays inline', () => {
  it('surfaces the server error and keeps the form usable', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unsupported file type — upload a JPEG, PNG, WebP, or PDF receipt' }), {
        status: 415,
        headers: { 'content-type': 'application/json' },
      })
    )
    await render()
    setInputFiles(new File([new TextEncoder().encode('nope')], 'r.png', { type: 'image/png' }))
    await act(async () => {
      checkbox().click()
    })

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      )
      await Promise.resolve()
    })
    await tick()

    expect(container.textContent).toContain('Unsupported file type')
    expect(container.textContent).not.toContain('submitted')
    expect(refreshMock).not.toHaveBeenCalled()
    expect(submitButton().disabled).toBe(false)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][0]).toContain('Unsupported file type')
  })
})
