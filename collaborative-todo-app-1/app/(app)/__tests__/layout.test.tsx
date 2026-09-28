// @vitest-environment jsdom
/**
 * @fileoverview App shell wiring test for the pending-review banner
 * (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (app/(app)/layout.tsx):
 * 1. The authenticated shell renders the pending-review banner under the
 *    nav — so the dashboard (and every app page) shows the subscriber's
 *    PENDING review without any extra navigation (story 13)
 * 2. The banner is mounted inside QueryProvider, i.e. its read runs
 *    through React Query against GET /api/billing/submissions
 * 3. With nothing under review the shell renders exactly as before —
 *    no banner for free users or team Members (story 17), and the
 *    page's own content is untouched (non-blocking, story 15)
 *
 * Module-boundary mocks: session, next/navigation, fetch (prior art:
 * components/subscription/__tests__/PendingReviewBanner.test.tsx).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const refreshMock = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn(),
}))

import AppLayout from '@/app/(app)/layout'

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

function routeFetch(input: RequestInfo | URL) {
  const url = String(input)
  if (url.startsWith('/api/notifications')) {
    return Promise.resolve(
      jsonResponse({ notifications: [], nextCursor: null, unreadCount: 0 })
    )
  }
  if (url.startsWith('/api/billing/submissions')) {
    return Promise.resolve(jsonResponse({ submissions: [PENDING_ROW] }))
  }
  return Promise.resolve(jsonResponse({ error: 'Not found' }, 404))
}

let container: HTMLDivElement
let root: Root | undefined

async function renderShell(submissions: unknown[]) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/billing/submissions')) {
      return Promise.resolve(jsonResponse({ submissions }))
    }
    return routeFetch(input)
  })

  const element = await AppLayout({
    children: <div data-testid="page-content">Dashboard content</div>,
  })
  root = createRoot(container)
  await act(async () => {
    root!.render(element)
  })
  // let both shell queries resolve and commit
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
  sessionMock.getSession.mockResolvedValue({
    user: { id: 'user_subscriber', email: 'sub@t.dev', name: 'Sub User' },
    session: { id: 's1' },
  })
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

describe('app shell — pending review banner (dashboard surface)', () => {
  it('shows the pending review under the nav while a submission is PENDING', async () => {
    await renderShell([PENDING_ROW])

    const banner = container.querySelector('[data-testid="pending-review-banner"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toContain('PAY-REVW-0002')
    expect(banner!.textContent).toMatch(/24 hours/i)
    expect(banner!.querySelector('a[href="/billing"]')).not.toBeNull()
    // non-blocking: the page's own content renders alongside it
    expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull()
  })

  it('leaves the shell untouched when nothing is under review (free user / team Member)', async () => {
    await renderShell([])

    expect(container.querySelector('[data-testid="pending-review-banner"]')).toBeNull()
    expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull()
  })

  it('reads the banner through the central billing query endpoint', async () => {
    await renderShell([PENDING_ROW])

    const billingCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.startsWith('/api/billing/submissions'))
    expect(billingCalls.length).toBeGreaterThan(0)
  })
})
