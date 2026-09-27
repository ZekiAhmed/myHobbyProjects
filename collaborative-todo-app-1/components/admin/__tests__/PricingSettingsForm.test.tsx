// @vitest-environment jsdom
/**
 * @fileoverview Component test for the admin pricing/bank-details form
 * (subscription-billing issue 02)
 *
 * CONTRACT UNDER TEST (PricingSettingsForm):
 * 1. The form renders the current persisted values in every field, so
 *    the Administrator edits what is actually stored
 * 2. Invalid input (an account number outside the 6–15 digit rule)
 *    shows an inline error and never calls the save action
 * 3. Valid input saves via the server action, then refreshes and toasts
 *    success
 * 4. A server refusal (ActionResult error) surfaces as an error toast
 *    and does NOT refresh — the form keeps the pre-refusal values
 * 5. A thrown action (network/server failure) surfaces as an error toast
 *    and does not refresh
 *
 * Module-boundary mocks: @/actions/pricing-settings, next/navigation,
 * sonner (prior art: components/admin/__tests__/RoleManager.test.tsx —
 * jsdom pragma, react-dom/client + act).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PricingSettingsForm } from '@/components/admin/PricingSettingsForm'
import type { PricingSettingsInput } from '@/lib/pricing-settings-schema'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const refreshMock = vi.hoisted(() => vi.fn())
const saveMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))
vi.mock('@/actions/pricing-settings', () => ({
  savePricingSettings: saveMock,
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

const SETTINGS: PricingSettingsInput = {
  price: 150,
  currency: 'ETB',
  accountHolder: 'Zeki Ahmed',
  accountNumber: '123456789012',
  bankName: 'Commercial Bank of Ethiopia',
  transferInstructions: 'Include your payment reference in the memo.',
}

function field(container: HTMLElement, name: string) {
  return container.querySelector<HTMLElement>(`[name="${name}"]`)
}

function fieldValue(container: HTMLElement, name: string) {
  const el = field(container, name)
  if (!el || !('value' in el)) throw new Error(`no field named ${name}`)
  return el.value
}

async function submitForm(container: HTMLElement) {
  const form = container.querySelector('form')
  if (!form) throw new Error('no form rendered')
  // async act: the save transition resolves after the dispatch returns
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('PricingSettingsForm', () => {
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

  async function render(settings: PricingSettingsInput = SETTINGS) {
    await act(async () => {
      root = createRoot(container)
      root.render(<PricingSettingsForm settings={settings} />)
    })
  }

  it('renders the current persisted values in every field', async () => {
    await render()

    expect(fieldValue(container, 'price')).toBe('150')
    expect(fieldValue(container, 'currency')).toBe('ETB')
    expect(fieldValue(container, 'accountHolder')).toBe('Zeki Ahmed')
    expect(fieldValue(container, 'accountNumber')).toBe('123456789012')
    expect(fieldValue(container, 'bankName')).toBe('Commercial Bank of Ethiopia')
    expect(fieldValue(container, 'transferInstructions')).toBe(
      'Include your payment reference in the memo.'
    )
  })

  it('shows an inline error for an account number outside 6–15 digits and never calls the action', async () => {
    await render({ ...SETTINGS, accountNumber: '12345' })

    await submitForm(container)

    expect(saveMock).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/6.*15 digits/i)
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('saves valid input via the action, then refreshes and toasts success', async () => {
    saveMock.mockResolvedValue({ success: true, data: SETTINGS })
    await render()

    await submitForm(container)

    expect(saveMock).toHaveBeenCalledWith({
      price: 150,
      currency: 'ETB',
      accountHolder: 'Zeki Ahmed',
      accountNumber: '123456789012',
      bankName: 'Commercial Bank of Ethiopia',
      transferInstructions: 'Include your payment reference in the memo.',
    })
    expect(toastSuccessMock).toHaveBeenCalled()
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces a server refusal as an error toast and does not refresh', async () => {
    saveMock.mockResolvedValue({
      success: false,
      error: { type: 'authorization', message: 'Only Administrators can manage pricing settings' },
    })
    await render()

    await submitForm(container)

    expect(toastErrorMock).toHaveBeenCalledWith('Only Administrators can manage pricing settings')
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('surfaces a thrown action as an error toast and does not refresh', async () => {
    saveMock.mockRejectedValue(new Error('network down'))
    await render()

    await submitForm(container)

    expect(toastErrorMock).toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
