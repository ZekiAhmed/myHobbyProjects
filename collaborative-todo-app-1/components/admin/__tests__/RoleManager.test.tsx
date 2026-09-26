// @vitest-environment jsdom
/**
 * @fileoverview Component test for the in-app promote/demote controls
 * (subscription-billing issue 01)
 *
 * CONTRACT UNDER TEST (RoleManager):
 * 1. Every user row shows name, email, and platform role; a regular user
 *    gets a Promote button, another Administrator gets a Demote button,
 *    and your own row gets neither (self-demotion is a server guard —
 *    the UI never offers it)
 * 2. Promote/Demote invoke the corresponding server action with the
 *    target id; on success the router refreshes and a success toast shows
 * 3. A server refusal (ActionResult error) surfaces as an error toast and
 *    does NOT refresh — the list keeps the pre-refusal state
 * 4. A thrown action (network/server failure) surfaces as an error toast
 *    and does not refresh
 *
 * Module-boundary mocks: @/actions/admin, next/navigation, sonner
 * (prior art: components/settings/__tests__/AccountSettingsClient.test.tsx
 * — jsdom pragma, react-dom/client + act).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { RoleManager, type AdminUserRow } from '@/components/admin/RoleManager'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const refreshMock = vi.hoisted(() => vi.fn())
const promoteMock = vi.hoisted(() => vi.fn())
const demoteMock = vi.hoisted(() => vi.fn())
const toastSuccessMock = vi.hoisted(() => vi.fn())
const toastErrorMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))
vi.mock('@/actions/admin', () => ({
  promoteAdministrator: promoteMock,
  demoteAdministrator: demoteMock,
}))
vi.mock('sonner', () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}))

const USERS: AdminUserRow[] = [
  { id: 'admin_self', name: 'Self Admin', email: 'self@t.dev', role: 'ADMINISTRATOR' },
  { id: 'admin_other', name: 'Other Admin', email: 'other@t.dev', role: 'ADMINISTRATOR' },
  { id: 'regular_one', name: 'Regular User', email: 'regular@t.dev', role: 'REGULAR' },
]

const CURRENT_USER_ID = 'admin_self'

function buttonByText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text)
  )
}

function buttonsWithText(container: HTMLElement, text: string) {
  return [...container.querySelectorAll('button')].filter((b) =>
    b.textContent?.includes(text)
  )
}

describe('RoleManager', () => {
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
      root.render(<RoleManager users={USERS} currentUserId={CURRENT_USER_ID} />)
    })
  }

  it('offers Promote for regular users, Demote for other Administrators, neither for yourself', async () => {
    await render()

    // rows show identity + role
    expect(container.textContent).toContain('regular@t.dev')
    expect(container.textContent).toContain('Regular User')
    expect(container.textContent).toContain('other@t.dev')
    expect(container.textContent).toContain('Administrator')

    // exactly one Promote (the regular user) and one Demote (the other admin)
    expect(buttonsWithText(container, 'Promote')).toHaveLength(1)
    expect(buttonsWithText(container, 'Demote')).toHaveLength(1)

    // your own row is marked and has no action button
    expect(container.textContent).toContain('You')
    expect(buttonByText(container, 'Promote')?.closest('div')?.parentElement).toBeTruthy()
    const selfRow = [...container.querySelectorAll('div')].find((d) =>
      d.textContent?.includes('self@t.dev')
    )
    expect(selfRow?.querySelectorAll('button')).toHaveLength(0)
  })

  it('promotes via the server action, then refreshes and toasts success', async () => {
    promoteMock.mockResolvedValue({ success: true, data: { userId: 'regular_one' } })
    await render()

    await act(async () => {
      buttonByText(container, 'Promote')?.click()
    })

    expect(promoteMock).toHaveBeenCalledWith('regular_one')
    expect(toastSuccessMock).toHaveBeenCalled()
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('demotes via the server action, then refreshes and toasts success', async () => {
    demoteMock.mockResolvedValue({ success: true, data: { userId: 'admin_other' } })
    await render()

    await act(async () => {
      buttonByText(container, 'Demote')?.click()
    })

    expect(demoteMock).toHaveBeenCalledWith('admin_other')
    expect(toastSuccessMock).toHaveBeenCalled()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces a server refusal as an error toast and does not refresh', async () => {
    demoteMock.mockResolvedValue({
      success: false,
      error: { type: 'authorization', message: 'Only Administrators can manage roles' },
    })
    await render()

    await act(async () => {
      buttonByText(container, 'Demote')?.click()
    })

    expect(toastErrorMock).toHaveBeenCalledWith('Only Administrators can manage roles')
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('surfaces a thrown action as an error toast and does not refresh', async () => {
    promoteMock.mockRejectedValue(new Error('network down'))
    await render()

    await act(async () => {
      buttonByText(container, 'Promote')?.click()
    })

    expect(toastErrorMock).toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })
})
