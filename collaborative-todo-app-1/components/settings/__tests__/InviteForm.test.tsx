// @vitest-environment jsdom
/**
 * @fileoverview The paywall at the invite moment (subscription-billing
 * issue 10)
 *
 * CONTRACT UNDER TEST (InviteForm):
 * 1. Nothing paywall-shaped renders BEFORE an attempt — the prompt
 *    appears exactly when the Owner tries to invite (spec story 25),
 *    never as a pre-emptive nag on the settings page
 * 2. A free Owner's refusal (error.reason "none") surfaces the paywall
 *    banner with the upgrade CTA — not a generic error toast
 * 3. A lapsed Owner's refusal (error.reason "expired") surfaces the
 *    RENEW prompt, not a generic error (checklist item 4)
 * 4. A Pro Owner's invitation sends with no paywall and no error toast
 * 5. A plain validation refusal keeps its inline form feedback — the
 *    paywall branch must not swallow it
 *
 * Module-boundary mocks: @/app/actions/invitations, sonner,
 * @/lib/queries/board-keys (prior art:
 * components/subscription/__tests__/ReceiptUploadForm.test.tsx).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const createInvitationMock = vi.hoisted(() => vi.fn())
const revokeInvitationMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/app/actions/invitations', () => ({
  createInvitation: createInvitationMock,
  revokeInvitation: revokeInvitationMock,
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))
vi.mock('@/lib/queries/board-keys', () => ({
  boardKeys: { invitations: (id: string) => ['invitations', id] },
  invitationsQueryOptions: () => ({
    queryKey: ['invitations', 'board_1'],
    queryFn: async () => [],
    staleTime: 10_000,
  }),
}))

import { InviteForm } from '@/components/settings/InviteForm'

const BOARD_ID = 'board_1'
const EMAIL = 'colleague@example.com'

let container: HTMLDivElement
let root: Root | undefined
let queryClient: QueryClient

async function render() {
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <InviteForm boardId={BOARD_ID} />
      </QueryClientProvider>
    )
  })
}

/** Types into the email field through the native setter React honours. */
function typeEmail(value: string) {
  const input = container.querySelector('input[type="email"]') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit() {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function paywall() {
  return container.querySelector('[data-testid="paywall-banner"]')
}

function paywallCta() {
  return container.querySelector('[data-testid="paywall-banner"] a[href="/upgrade"]')
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
})

describe('InviteForm — the prompt comes at the paid moment, not before', () => {
  it('renders no paywall on a fresh settings page', async () => {
    await render()

    expect(container.querySelector('form')).not.toBeNull()
    expect(paywall()).toBeNull()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces the upgrade paywall the moment a free Owner tries to invite', async () => {
    createInvitationMock.mockResolvedValue({
      success: false,
      error: {
        type: 'authorization',
        message: 'Inviting members to a board needs an active Pro subscription.',
        reason: 'none',
      },
    })
    await render()
    typeEmail(EMAIL)
    await submit()

    expect(createInvitationMock).toHaveBeenCalledWith(BOARD_ID, EMAIL)
    expect(paywall()).not.toBeNull()
    expect(paywall()!.textContent).toContain('active Pro subscription')
    expect(paywallCta()!.textContent).toMatch(/upgrade/i)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('shows a lapsed Owner the renew prompt, not a generic error', async () => {
    createInvitationMock.mockResolvedValue({
      success: false,
      error: {
        type: 'authorization',
        message: 'Your Pro subscription has expired. Renew Pro to invite members to this board.',
        reason: 'expired',
      },
    })
    await render()
    typeEmail(EMAIL)
    await submit()

    expect(paywall()).not.toBeNull()
    expect(paywall()!.textContent).toMatch(/expired/i)
    expect(paywallCta()!.textContent).toMatch(/renew/i)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})

describe('InviteForm — the interruption-free paths', () => {
  it('sends a Pro Owner invitation with no paywall and a success toast', async () => {
    createInvitationMock.mockResolvedValue({
      success: true,
      data: { id: 'inv_1', boardId: BOARD_ID, email: EMAIL },
    })
    await render()
    typeEmail(EMAIL)
    await submit()

    expect(toastSuccessMock).toHaveBeenCalledWith('Invitation sent!')
    expect(paywall()).toBeNull()
    expect(toastErrorMock).not.toHaveBeenCalled()
    const input = container.querySelector('input[type="email"]') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('keeps a plain validation refusal inline, without the paywall', async () => {
    createInvitationMock.mockResolvedValue({
      success: false,
      error: { type: 'validation', message: 'This user is already a member of this board' },
    })
    await render()
    typeEmail(EMAIL)
    await submit()

    expect(container.querySelector('#email-error')!.textContent).toContain('already a member')
    expect(paywall()).toBeNull()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})
