// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, type AnchorHTMLAttributes } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AccountSettingsClient } from '@/components/settings/AccountSettingsClient'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/settings',
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('AccountSettingsClient', () => {
  let container: HTMLDivElement
  let root: Root | undefined

  beforeEach(() => {
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

  it('renders without Base UI native <button> semantics warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await act(async () => {
      root = createRoot(container)
      root.render(
        <AccountSettingsClient name="Test User" email="test@example.com" />
      )
    })

    const buttonSemanticsErrors = errorSpy.mock.calls.filter((args) =>
      args.some((arg) => String(arg).includes('expected a native'))
    )

    expect(buttonSemanticsErrors).toEqual([])
  })
})
