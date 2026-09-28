// @vitest-environment jsdom
/**
 * @fileoverview Pending-review banner tests (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (PendingReviewBanner):
 * 1. Renders nothing while the history is loading or has no PENDING
 *    attempt — a free user and a team Member (story 17) see no banner
 *    at all
 * 2. With a PENDING attempt it renders an informational, non-blocking
 *    status region (never a modal) carrying the reference, the 24-hour
 *    promise copy, and a link into billing history (story 13)
 * 3. A failed history read renders nothing — a billing outage must never
 *    break the app shell
 * 4. The read goes through the central query options
 *    (GET /api/billing/submissions via billingSubmissionsQueryOptions)
 *
 * jsdom environment — prior art:
 * components/subscription/__tests__/ReceiptUploadForm.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

import { PendingReviewBanner } from '@/components/subscription/PendingReviewBanner'

const PENDING_ROW = {
  id: 'sub_pending',
  reference: 'PAY-REVW-0002',
  status: 'PENDING',
  priceSnapshot: 250,
  currencySnapshot: 'ETB',
  createdAt: '2026-09-28T09:00:00.000Z',
  updatedAt: '2026-09-28T10:00:00.000Z',
  expiresAt: '2026-09-30T09:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

let container: HTMLDivElement
let root: Root | undefined

async function render() {
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PendingReviewBanner />
      </QueryClientProvider>
    )
  })
}

/** Flush microtasks + a timer turn inside act so the query can settle. */
async function flush(ticks = 25) {
  for (let i = 0; i < ticks; i++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function renderAndWait() {
  await render()
  await flush()
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
  vi.unstubAllGlobals()
})

describe('PendingReviewBanner — visible only while a submission is under review', () => {
  it('renders the banner with the reference, the 24-hour promise, and a link to billing history', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [PENDING_ROW] }))

    await renderAndWait()

    const banner = container.querySelector('[role="status"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toContain('PAY-REVW-0002')
    expect(banner!.textContent).toMatch(/24 hours/i)
    expect(banner!.textContent).toMatch(/awaiting review/i)
    expect(container.querySelector('a[href="/billing"]')).not.toBeNull()
    // informational only — waiting never blocks the app (story 15)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders nothing when the user has no submission under review (free user / team Member)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [] }))

    await renderAndWait()

    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing while the history is still loading', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))

    await render()

    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('renders nothing when the history read fails — a billing outage never breaks the shell', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500))

    await renderAndWait()

    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('PendingReviewBanner — read path', () => {
  it('reads through the central query options (GET /api/billing/submissions)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [] }))

    await renderAndWait()

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/billing/submissions')
  })
})
