// @vitest-environment jsdom
/**
 * @fileoverview Component test for the Subscribe button
 * (subscription-billing issue 04)
 *
 * CONTRACT UNDER TEST (SubscribeButton):
 * 1. Clicking starts a payment attempt via the server action, then
 *    refreshes the server-rendered screen so the instruction card
 *    replaces the button — and toasts success
 * 2. A refusal (ActionResult error) surfaces its actionable message as
 *    an error toast and does NOT refresh — the screen keeps its state
 * 3. A thrown action (network/server failure) surfaces as an error
 *    toast and does not refresh
 *
 * Module-boundary mocks: @/actions/subscribe, next/navigation, sonner
 * (prior art: components/admin/__tests__/PricingSettingsForm.test.tsx).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { SubscribeButton } from '@/components/subscription/SubscribeButton'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const refreshMock = vi.hoisted(() => vi.fn())
const requestMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))
vi.mock('@/actions/subscribe', () => ({
  requestPaymentInstructions: requestMock,
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

describe('SubscribeButton', () => {
  let container: HTMLDivElement
  let root: Root | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    if (root) {
      act(() => root?.unmount())
      root = undefined
    }
    container.remove()
    vi.restoreAllMocks()
  })

  async function render() {
    await act(async () => {
      root = createRoot(container)
      root.render(<SubscribeButton />)
    })
  }

  async function clickSubscribe() {
    const button = container.querySelector('button')
    if (!button) throw new Error('no button rendered')
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  it('starts a payment attempt via the action, then refreshes and toasts success', async () => {
    requestMock.mockResolvedValue({ success: true, data: { id: 'sub_1' } })
    await render()

    await clickSubscribe()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).toHaveBeenCalledWith('Payment instructions ready')
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces a refusal with its actionable message and does not refresh', async () => {
    requestMock.mockResolvedValue({
      success: false,
      error: {
        type: 'validation',
        message:
          'You already have a payment attempt in progress (reference PAY-LIVE-0001). Upload your receipt for that reference before starting a new one — one attempt at a time keeps payments from being double-counted.',
      },
    })
    await render()

    await clickSubscribe()

    // the message a test would otherwise have to guess at is surfaced verbatim
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][0]).toContain('PAY-LIVE-0001')
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('toasts a server refusal exactly once — the helper owns that toast, the button must not double it', async () => {
    requestMock.mockResolvedValue({
      success: false,
      error: { type: 'server', message: 'Failed to start a payment attempt' },
    })
    await render()

    await clickSubscribe()

    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('surfaces a thrown action as an error toast and does not refresh', async () => {
    requestMock.mockRejectedValue(new Error('network down'))
    await render()

    await clickSubscribe()

    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
