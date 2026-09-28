// @vitest-environment jsdom
/**
 * @fileoverview Billing history tests (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (BillingHistory):
 * 1. Lists every attempt with status, timestamps, amount, and reference
 *    (spec story 14) — one row per submission, API order (newest first)
 * 2. Every status shown carries the 24-hour review promise copy
 *    (checklist) — via the shared lib/payment-status helper
 * 3. An empty history reads as "no attempts yet", never as an error
 * 4. A failed read surfaces an error state — it never fabricates an
 *    empty history
 * 5. The read goes through the central query options
 *    (GET /api/billing/submissions)
 * 6. A rejected attempt shows the exact stored reason next to it, plus
 *    the "submit a new receipt" entry point that starts a fresh attempt
 *    (issue 08, spec stories 19 + 20) — and no other row offers it
 *
 * jsdom environment — prior art:
 * components/subscription/__tests__/PendingReviewBanner.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
const requestMock = vi.hoisted(() => vi.fn())
const pushMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/actions/subscribe', () => ({ requestPaymentInstructions: requestMock }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

import { BillingHistory } from '@/components/subscription/BillingHistory'

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

const EXPIRED_ROW = {
  id: 'sub_expired',
  reference: 'PAY-EXPD-0001',
  status: 'EXPIRED',
  priceSnapshot: 100,
  currencySnapshot: 'ETB',
  createdAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-22T08:00:00.000Z',
  expiresAt: '2026-09-22T08:00:00.000Z',
}

const REJECTED_ROW = {
  id: 'sub_rejected',
  reference: 'PAY-RJCT-0003',
  status: 'REJECTED',
  priceSnapshot: 250,
  currencySnapshot: 'ETB',
  rejectionReason: 'Amount mismatch — received 90 ETB, expected 250 ETB',
  createdAt: '2026-09-28T09:00:00.000Z',
  updatedAt: '2026-09-29T09:00:00.000Z',
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
        <BillingHistory />
      </QueryClientProvider>
    )
  })
}

/** Flush microtasks + a timer turn inside act so the query can settle. */
async function renderAndWait() {
  await render()
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
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

describe('BillingHistory — durable record of every attempt (story 14)', () => {
  it('lists each attempt with status, timestamps, amount, and reference', async () => {
    // newest first, exactly as the endpoint returns them
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [PENDING_ROW, EXPIRED_ROW] }))

    await renderAndWait()

    const rows = container.querySelectorAll('[data-testid="billing-row"]')
    expect(rows).toHaveLength(2)

    const [latest, older] = rows
    expect(latest.textContent).toContain('PAY-REVW-0002')
    expect(latest.textContent).toContain('250 ETB')
    expect(latest.textContent).toMatch(/under review/i)
    // timestamps render machine-readably (the visible text is locale/tz
    // dependent; the datetime attribute is the contract)
    expect(latest.querySelector('time[datetime="2026-09-28T09:00:00.000Z"]')).not.toBeNull()
    expect(latest.querySelector('time[datetime="2026-09-28T10:00:00.000Z"]')).not.toBeNull()

    expect(older.textContent).toContain('PAY-EXPD-0001')
    expect(older.textContent).toContain('100 ETB')
    expect(older.textContent).toMatch(/expired/i)
    expect(older.querySelector('time[datetime="2026-09-20T08:00:00.000Z"]')).not.toBeNull()
  })

  it('shows the 24-hour review promise alongside every status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [PENDING_ROW, EXPIRED_ROW] }))

    await renderAndWait()

    for (const row of container.querySelectorAll('[data-testid="billing-row"]')) {
      expect(row.textContent).toMatch(/24[-\s]hour/i)
    }
    expect(container.textContent).toContain('Receipts are reviewed within 24 hours.')
  })

  it('reads through the central query options (GET /api/billing/submissions)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [] }))

    await renderAndWait()

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/billing/submissions')
  })
})

describe('BillingHistory — empty and error states', () => {
  it('reads an empty history as "no attempts yet", not as an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [] }))

    await renderAndWait()

    expect(container.querySelectorAll('[data-testid="billing-row"]')).toHaveLength(0)
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toMatch(/no payment attempts yet/i)
  })

  it('surfaces a failed read as an error instead of fabricating an empty history', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500))

    await renderAndWait()

    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.textContent).not.toMatch(/no payment attempts yet/i)
  })

  it('shows a loading state until the history arrives', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}))

    await render()

    expect(container.textContent).toMatch(/loading/i)
  })
})

describe('BillingHistory — rejection delivery (issue 08)', () => {
  async function flush() {
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await Promise.resolve()
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }
  }

  function resubmitButton(): HTMLButtonElement | undefined {
    return [...container.querySelectorAll('button')].find((button) =>
      /submit a new receipt/i.test(button.textContent ?? '')
    )
  }

  it('shows the exact rejection reason next to the attempt (story 19)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [REJECTED_ROW] }))

    await renderAndWait()

    const reason = container.querySelector('[data-testid="billing-rejection-reason"]')
    expect(reason).not.toBeNull()
    expect(reason!.textContent).toContain('Amount mismatch — received 90 ETB, expected 250 ETB')
    // the reason belongs to the rejected row, not to the table at large
    expect(reason!.closest('[data-testid="billing-row"]')).not.toBeNull()
  })

  it('offers "submit a new receipt" on the rejected row and starts a fresh attempt (story 20)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [REJECTED_ROW] }))
    requestMock.mockResolvedValue({ success: true, data: { id: 'sub_new' } })

    await renderAndWait()
    const button = resubmitButton()
    expect(button).toBeDefined()

    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flush()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/upgrade')
    expect(toastSuccessMock).toHaveBeenCalledWith('Payment instructions ready')
  })

  it('keeps the subscriber on the page when a fresh attempt is refused, with the reason toasted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [REJECTED_ROW] }))
    requestMock.mockResolvedValue({
      success: false,
      error: { type: 'validation', message: 'reference PAY-LIVE-0001 is already under review' },
    })

    await renderAndWait()
    await act(async () => {
      resubmitButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flush()

    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][0]).toContain('PAY-LIVE-0001')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('offers no resubmit entry point on rows that are not rejected', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ submissions: [PENDING_ROW, EXPIRED_ROW] })
    )

    await renderAndWait()

    expect(container.querySelector('[data-testid="submit-new-receipt"]')).toBeNull()
  })
})
