// @vitest-environment jsdom
/**
 * @fileoverview Review queue component tests (subscription-billing issue 07)
 *
 * CONTRACT UNDER TEST (ReviewQueue):
 * 1. Every pending submission renders as a card carrying the snapshot
 *    amount, the submitter's name + email, the submission time (with a
 *    machine-readable datetime), the reference, and the amount + sender
 *    + date fallback hint — oldest card first, in the order the route
 *    returns
 * 2. The aging badge reads "OVERDUE" past the 24-hour promise and the
 *    hours-left countdown inside it (lib/review-aging decides wording;
 *    these tests pin the card's wiring of it)
 * 3. The receipt viewer link appears only when a receipt exists, and
 *    points at the admin-gated route
 * 4. Empty and failed reads say so — a 403/500 must never read as a
 *    fake empty queue an operator shrugs off
 * 5. Approve calls the server action with the card's id; on success it
 *    invalidates adminKeys.reviewQueue() (card leaves the list) and
 *    toasts; a refusal only toasts and invalidates nothing
 * 6. Reject stays disabled until a non-empty reason is typed, then
 *    sends { submissionId, reason }; a refusal toasts without
 *    invalidating
 *
 * Module-boundary mocks: @/actions/payment-review, sonner; the queue
 * read itself goes through a stubbed fetch (prior art: PendingReviewBanner,
 * RoleManager tests — jsdom pragma, react-dom/client + act).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const approveMock = vi.hoisted(() => vi.fn())
const rejectMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/actions/payment-review', () => ({
  approveSubmission: approveMock,
  rejectSubmission: rejectMock,
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

import { ReviewQueue } from '@/components/admin/ReviewQueue'
import type { ReviewQueueSubmission } from '@/lib/types'

const HOUR_MS = 60 * 60 * 1000

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString()
}

/** Oldest first — exactly what GET /api/admin/review-queue returns. */
const OLDER_ROW: ReviewQueueSubmission = {
  id: 'sub_older',
  reference: 'PAY-OLD-0001',
  priceSnapshot: 250,
  currencySnapshot: 'ETB',
  receiptMimeType: null,
  // instructions created 31h ago, receipt landed 30h ago — the badge
  // counts from the receipt (queue entry), which is 30h → OVERDUE
  createdAt: isoHoursAgo(31),
  updatedAt: isoHoursAgo(30),
  user: { id: 'u_grace', name: 'Grace Hopper', email: 'grace@t.dev' },
}

const FRESHER_ROW: ReviewQueueSubmission = {
  id: 'sub_fresher',
  reference: 'PAY-NEW-0002',
  priceSnapshot: 900,
  currencySnapshot: 'ETB',
  receiptMimeType: 'image/png',
  createdAt: isoHoursAgo(6),
  // 5.9h old, not 6: the badge floors whole hours against the render
  // clock, and exactly 6h would land on 17h59m once the query settles
  updatedAt: isoHoursAgo(5.9),
  user: { id: 'u_ada', name: 'Ada Lovelace', email: 'ada@t.dev' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

let container: HTMLDivElement
let root: Root | undefined
let queryClient: QueryClient

async function render() {
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <ReviewQueue />
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

function cards(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="review-card"]')]
}

function cardWithReference(reference: string): HTMLElement | undefined {
  return cards().find((card) => card.textContent?.includes(reference))
}

function buttonIn(card: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...card.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
}

function typeReason(card: HTMLElement, value: string) {
  const textarea = card.querySelector('textarea') as HTMLTextAreaElement
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set
  setter!.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(
    jsonResponse({ submissions: [OLDER_ROW, FRESHER_ROW] })
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

describe('ReviewQueue — the card carries everything needed to decide', () => {
  it('renders amount, submitter identity, submission time, reference, and the fallback hint, oldest first', async () => {
    await renderAndWait()

    const rendered = cards()
    expect(rendered).toHaveLength(2)
    // order preserved: oldest first, the route's contract
    expect(rendered[0].textContent).toContain('PAY-OLD-0001')
    expect(rendered[1].textContent).toContain('PAY-NEW-0002')

    const older = cardWithReference('PAY-OLD-0001')!
    expect(older.textContent).toContain('250 ETB')
    expect(older.textContent).toContain('Grace Hopper')
    expect(older.textContent).toContain('grace@t.dev')
    // machine-readable timestamp: queue-entry time (updatedAt), when
    // the receipt landed and the review clock started
    expect(older.querySelector('time')?.getAttribute('datetime')).toBe(
      new Date(OLDER_ROW.updatedAt).toISOString()
    )
    // the no-memo fallback an operator can match against a bank statement
    expect(older.textContent).toMatch(/No memo reference/i)
    expect(older.textContent).toContain('250 ETB')
    expect(older.textContent).toContain('Grace Hopper')
  })

  it('ages honestly: OVERDUE past the 24-hour promise, hours left inside it', async () => {
    await renderAndWait()

    const olderBadge = cardWithReference('PAY-OLD-0001')!.querySelector(
      '[data-testid="aging-badge"]'
    )!
    const fresherBadge = cardWithReference('PAY-NEW-0002')!.querySelector(
      '[data-testid="aging-badge"]'
    )!

    // 30h in the queue → past the window
    expect(olderBadge.textContent).toBe('OVERDUE')
    expect(olderBadge.className).toMatch(/destructive/)
    // ~6h in the queue → ~18h remain (floored)
    expect(fresherBadge.textContent).toBe('18h left')
  })

  it('ages from queue entry, not the older instruction creation — a late upload starts its own 24 hours', async () => {
    // Instructions created 30h ago, receipt uploaded ~54m ago (under
    // an hour so the floor still reads a full hour once the query
    // settles): the promise only started when the row became
    // reviewable, so the badge must countdown, not read OVERDUE on
    // arrival
    fetchMock.mockResolvedValue(
      jsonResponse({
        submissions: [
          {
            ...OLDER_ROW,
            reference: 'PAY-LATE-0009',
            createdAt: isoHoursAgo(30),
            updatedAt: isoHoursAgo(0.9),
          },
        ],
      })
    )

    await renderAndWait()

    const badge = cardWithReference('PAY-LATE-0009')!.querySelector(
      '[data-testid="aging-badge"]'
    )!
    expect(badge.textContent).toBe('23h left')
    expect(badge.textContent).not.toBe('OVERDUE')
  })

  it('links the admin receipt viewer only when a receipt exists', async () => {
    await renderAndWait()

    const withReceipt = cardWithReference('PAY-NEW-0002')!
    const link = withReceipt.querySelector('a') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('/api/receipts?reference=PAY-NEW-0002')
    expect(link.getAttribute('target')).toBe('_blank')

    expect(cardWithReference('PAY-OLD-0001')!.querySelector('a')).toBeNull()
  })
})

describe('ReviewQueue — read states', () => {
  it('says the queue is empty when nothing is pending', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissions: [] }))

    await renderAndWait()

    expect(container.querySelector('[data-testid="queue-empty"]')).not.toBeNull()
    expect(cards()).toHaveLength(0)
  })

  it('surfaces a failed read as an alert — a refusal never reads as an empty queue', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403))

    await renderAndWait()

    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="queue-empty"]')).toBeNull()
  })

  it('reads through GET /api/admin/review-queue', async () => {
    await renderAndWait()

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/admin/review-queue')
  })
})

describe('ReviewQueue — approve', () => {
  it('approves the card with its id, then invalidates the queue and toasts the new period end', async () => {
    approveMock.mockResolvedValue({
      success: true,
      data: { submissionId: 'sub_older', periodEnd: new Date('2026-11-28T10:00:00.000Z') },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await renderAndWait()

    await act(async () => {
      buttonIn(cardWithReference('PAY-OLD-0001')!, 'Approve')!.click()
    })
    await flush(10)

    expect(approveMock).toHaveBeenCalledWith({ submissionId: 'sub_older' })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'review-queue'] })
    // the period the payment bought, as a clamped CALENDAR date — never
    // a timestamp with a clock reading (issue 11, spec story 33)
    expect(toastSuccessMock).toHaveBeenCalledWith(
      expect.stringContaining('paid through 28 November')
    )
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces a refusal (the terminal-state guard) as an error toast and invalidates nothing', async () => {
    approveMock.mockResolvedValue({
      success: false,
      error: { type: 'validation', message: 'This payment has already been decided' },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await renderAndWait()

    await act(async () => {
      buttonIn(cardWithReference('PAY-OLD-0001')!, 'Approve')!.click()
    })
    await flush(10)

    expect(toastErrorMock).toHaveBeenCalledWith('This payment has already been decided')
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})

describe('ReviewQueue — reject requires a reason', () => {
  it('keeps Reject disabled until a reason is typed, then sends it and invalidates on success', async () => {
    rejectMock.mockResolvedValue({
      success: true,
      data: { submissionId: 'sub_older' },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await renderAndWait()

    const card = cardWithReference('PAY-OLD-0001')!
    expect(buttonIn(card, 'Reject')!.disabled).toBe(true)

    await act(async () => {
      typeReason(card, '  Amount mismatch — received 90 ETB  ')
    })
    expect(buttonIn(card, 'Reject')!.disabled).toBe(false)

    await act(async () => {
      buttonIn(card, 'Reject')!.click()
    })
    await flush(10)

    expect(rejectMock).toHaveBeenCalledWith({
      submissionId: 'sub_older',
      reason: '  Amount mismatch — received 90 ETB  ',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'review-queue'] })
    expect(toastSuccessMock).toHaveBeenCalledWith('Payment rejected')
  })

  it('surfaces a rejection refusal as an error toast and keeps the card', async () => {
    rejectMock.mockResolvedValue({
      success: false,
      error: { type: 'validation', message: 'This payment has already been decided' },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await renderAndWait()

    const card = cardWithReference('PAY-OLD-0001')!
    await act(async () => {
      typeReason(card, 'too late')
    })
    await act(async () => {
      buttonIn(card, 'Reject')!.click()
    })
    await flush(10)

    expect(toastErrorMock).toHaveBeenCalledWith('This payment has already been decided')
    expect(invalidateSpy).not.toHaveBeenCalled()
    expect(cardWithReference('PAY-OLD-0001')).toBe(card)
  })
})
