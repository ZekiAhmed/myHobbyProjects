// @vitest-environment jsdom
/**
 * @fileoverview Notification bell delivery tests (subscription-billing issue 08)
 *
 * CONTRACT UNDER TEST (NotificationBell):
 * 1. A payment approval reads as the outcome it is — the subscriber is
 *    told they can now invite their team (spec story 18), with the
 *    deciding Administrator as the actor
 * 2. A payment rejection points the subscriber at the reason in billing
 *    history (spec story 19)
 * 3. Opening a payment decision navigates to /billing — it has no board
 *    and no todo to deep-link into — marks the row read, and refreshes
 *    billing history so the reason/resubmit state on screen is not a
 *    pre-decision snapshot (spec story 19)
 * 4. Board notifications keep their old contract: the row summary names
 *    the Todo and opening deep-links into the board's side panel
 *
 * Module-boundary mocks: next/navigation, @/actions/notifications
 * (prior art: components/subscription/__tests__/SubscribeButton.test.tsx);
 * the feed itself arrives through the stubbed global fetch, exactly like
 * components/subscription/__tests__/BillingHistory.test.tsx.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const pushMock = vi.hoisted(() => vi.fn())
const markOneMock = vi.hoisted(() => vi.fn())
const markAllMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))
vi.mock('@/actions/notifications', () => ({
  markNotificationRead: markOneMock,
  markAllNotificationsRead: markAllMock,
}))

import { NotificationBell } from '@/components/NotificationBell'

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

function feedResponse(notifications: unknown[]) {
  return new Response(
    JSON.stringify({ notifications, nextCursor: null, unreadCount: notifications.length }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}

/** A payment decision row: no board, no todo — issue 08. */
function paymentRow(id: string, type: 'PAYMENT_APPROVED' | 'PAYMENT_REJECTED') {
  return {
    id,
    type,
    readAt: null,
    createdAt: '2026-09-29T09:00:00.000Z',
    boardId: null,
    actor: { id: 'user_admin', name: 'Ada Admin', image: null },
    todo: null,
  }
}

let container: HTMLDivElement
let root: Root | undefined
let queryClient: QueryClient

async function renderAndWait() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
      </QueryClientProvider>
    )
  })
  for (let i = 0; i < 25; i++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

async function openBell() {
  const trigger = document.querySelector('[aria-label^="Notifications"]')
  if (!trigger) throw new Error('bell trigger not rendered')
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

/** Click the dropdown row whose text matches `pattern`. */
async function clickRow(pattern: RegExp) {
  const row = [...document.querySelectorAll('button')].find(
    (button) => button.textContent && pattern.test(button.textContent)
  )
  if (!row) throw new Error(`no notification row matching ${pattern}`)
  await act(async () => {
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  vi.stubGlobal('fetch', fetchMock)
  markOneMock.mockResolvedValue({ success: true })
  markAllMock.mockResolvedValue({ success: true })
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
  vi.unstubAllGlobals()
})

describe('NotificationBell — payment decisions (issue 08)', () => {
  it('reads an approval as the outcome: approved, and the team can now be invited', async () => {
    fetchMock.mockResolvedValue(feedResponse([paymentRow('n_ok', 'PAYMENT_APPROVED')]))

    await renderAndWait()
    await openBell()

    expect(document.body.textContent).toContain(
      'Ada Admin approved your payment — you can now invite your team'
    )
  })

  it('reads a rejection as pointing at the reason in billing history (story 19)', async () => {
    fetchMock.mockResolvedValue(feedResponse([paymentRow('n_no', 'PAYMENT_REJECTED')]))

    await renderAndWait()
    await openBell()

    expect(document.body.textContent).toContain(
      'Ada Admin rejected your payment — the reason is in your billing history'
    )
  })

  it('opens a payment decision at /billing — no board, no todo — and marks it read', async () => {
    fetchMock.mockResolvedValue(feedResponse([paymentRow('n_no', 'PAYMENT_REJECTED')]))

    await renderAndWait()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await openBell()
    await clickRow(/rejected your payment/)

    expect(pushMock).toHaveBeenCalledWith('/billing')
    expect(markOneMock).toHaveBeenCalledWith('n_no')
    // billing history must refresh before landing — a cached pre-decision
    // row would hide the reason and the resubmit entry point (story 19)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['billing'] })
  })
})

describe('NotificationBell — board notifications keep their contract', () => {
  const ASSIGNED_ROW = {
    id: 'n_assign',
    type: 'ASSIGNED',
    readAt: null,
    createdAt: '2026-09-29T09:00:00.000Z',
    boardId: 'board_1',
    actor: { id: 'user_owner', name: 'Ola Owner', image: null },
    todo: { id: 'todo_1', title: 'Ship it' },
  }

  it('summarizes an assignment by its Todo and deep-links into the board', async () => {
    fetchMock.mockResolvedValue(feedResponse([ASSIGNED_ROW]))

    await renderAndWait()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    await openBell()

    expect(document.body.textContent).toContain('Ola Owner assigned you to “Ship it”')

    await clickRow(/assigned you to/)
    expect(pushMock).toHaveBeenCalledWith('/boards/board_1?todo=todo_1')
    // board navigation leaves billing history alone
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['billing'] })
  })
})
