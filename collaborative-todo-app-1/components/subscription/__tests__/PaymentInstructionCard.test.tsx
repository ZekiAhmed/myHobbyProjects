// @vitest-environment jsdom
/**
 * @fileoverview Component test for the payment instruction card
 * (subscription-billing issue 04)
 *
 * CONTRACT UNDER TEST (PaymentInstructionCard):
 * 1. Renders everything a bank transfer needs: the snapshotted amount,
 *    the unique reference, the account holder/number/bank, the
 *    transfer instructions, and the memo nudge naming the reference
 * 2. The copy chip writes exactly the reference to the clipboard and
 *    confirms with a toast + a "Copied" state
 * 3. A clipboard failure (insecure context, denied permission) surfaces
 *    an error toast instead of failing silently
 *
 * Module-boundary mocks: sonner (prior art:
 * components/admin/__tests__/PricingSettingsForm.test.tsx — jsdom
 * pragma, react-dom/client + act).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PaymentInstructionCard } from '@/components/subscription/PaymentInstructionCard'
import type { PricingSettingsInput } from '@/lib/pricing-settings-schema'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

const SUBMISSION = {
  reference: 'PAY-COPY-0001',
  priceSnapshot: 175,
  currencySnapshot: 'ETB',
  expiresAt: new Date('2026-09-30T12:00:00.000Z'),
}

const SETTINGS: PricingSettingsInput = {
  price: 250,
  currency: 'ETB',
  accountHolder: 'Zeki Ahmed',
  accountNumber: '123456789012',
  bankName: 'Commercial Bank of Ethiopia',
  transferInstructions: 'Include your payment reference in the memo.',
}

const writeTextMock = vi.fn()

describe('PaymentInstructionCard', () => {
  let container: HTMLDivElement
  let root: Root | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    writeTextMock.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })
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
      root.render(<PaymentInstructionCard submission={SUBMISSION} settings={SETTINGS} />)
    })
  }

  function copyButton(): HTMLButtonElement {
    const button = container.querySelector('[aria-label="Copy payment reference"]')
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error('no copy button rendered')
    }
    return button
  }

  it('renders the reference, snapshotted amount, bank details, instructions, and the memo nudge', async () => {
    await render()

    const text = container.textContent ?? ''
    // unique reference, both as the chip and inside the memo nudge
    expect(text).toContain('PAY-COPY-0001')
    expect(text).toContain('Include PAY-COPY-0001 in the transfer memo')
    // the attempt's snapshot, not the live settings price
    expect(text).toContain('175 ETB')
    expect(text).not.toContain('250')
    // bank details + transfer instructions from settings
    expect(text).toContain('Zeki Ahmed')
    expect(text).toContain('123456789012')
    expect(text).toContain('Commercial Bank of Ethiopia')
    expect(text).toContain('Include your payment reference in the memo.')
  })

  it('copies exactly the reference to the clipboard and confirms it', async () => {
    await render()

    await act(async () => {
      copyButton().click()
    })

    expect(writeTextMock).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith('PAY-COPY-0001')
    expect(toastSuccessMock).toHaveBeenCalledWith('Payment reference copied')
    expect(toastErrorMock).not.toHaveBeenCalled()
    // the chip flips to its copied state
    expect(copyButton().textContent).toMatch(/copied/i)
  })

  it('surfaces an error toast when the clipboard is unavailable', async () => {
    writeTextMock.mockRejectedValue(new Error('NotAllowedError'))
    await render()

    await act(async () => {
      copyButton().click()
    })

    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
