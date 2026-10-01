/**
 * @fileoverview Marketing shell test — header/footer wiring (full
 * marketing landing)
 *
 * CONTRACT UNDER TEST (app/(marketing)/layout.tsx):
 * 1. A signed-out header offers Sign in + Get started, and the nav
 *    anchors to #how-it-works / #features / #pricing — every id the
 *    landing page exposes
 * 2. A signed-in header swaps to "Go to dashboard" only — no sign-in or
 *    sign-up offer anywhere in the shell (matches the hero's branching)
 * 3. The footer carries the brand/tagline, the same section anchors, an
 *    auth column that branches with the session, and a © year line
 *
 * Module-boundary mocks: session source, next/headers
 * (prior art: app/(app)/upgrade/__tests__/page.test.tsx — the real
 * getOptionalSession runs on purpose).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => sessionMock.getSession() } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import MarketingLayout from '@/app/(marketing)/layout'

function signIn() {
  sessionMock.getSession.mockResolvedValue({
    user: { id: 'user_1', email: 'u@t.dev', name: 'Test User' },
    session: { id: 's1' },
  })
}

function signOut() {
  sessionMock.getSession.mockResolvedValue(null)
}

/** Renders the shell around placeholder page content. */
async function renderShell(): Promise<string> {
  const element = await MarketingLayout({
    children: <div data-testid="page-content">Landing content</div>,
  })
  return renderToStaticMarkup(element)
}

beforeEach(() => {
  vi.clearAllMocks()
  signOut()
})

describe('marketing header (session-aware chrome)', () => {
  it('offers Sign in + Get started to a signed-out visitor', async () => {
    signOut()

    const html = await renderShell()

    expect(html).toContain('/sign-in')
    expect(html).toContain('/sign-up')
    expect(html).toContain('Sign in')
    expect(html).toContain('Get started')
    expect(html).not.toContain('/boards')
  })

  it('offers only Go to dashboard to a signed-in visitor', async () => {
    signIn()

    const html = await renderShell()

    expect(html).toContain('Go to dashboard')
    expect(html).toContain('/boards')
    expect(html).not.toContain('/sign-in')
    expect(html).not.toContain('/sign-up')
  })

  it('anchors the section nav at the ids the landing page exposes', async () => {
    const html = await renderShell()

    expect(html).toContain('href="#how-it-works"')
    expect(html).toContain('href="#features"')
    expect(html).toContain('href="#pricing"')
    expect(html).toContain('aria-label="Page sections"')
  })
})

describe('marketing footer', () => {
  it('carries brand, section anchors, and the © year line', async () => {
    const html = await renderShell()

    expect(html).toContain('A collaborative todo app for small teams')
    expect(html).toContain(`© ${new Date().getFullYear()} Kanify`)
    // the product column repeats the section anchors
    expect(html).toContain('href="#features"')
    expect(html).toContain('href="#pricing"')
    // page content sits between header and footer untouched
    expect(html).toContain('Landing content')
  })

  it('branches the auth column with the session', async () => {
    signOut()
    const signedOutHtml = await renderShell()
    expect(signedOutHtml).toContain('Get started')
    expect(signedOutHtml).toContain('Create an account')
    expect(signedOutHtml).not.toContain('/boards')

    signIn()
    const signedInHtml = await renderShell()
    expect(signedInHtml).toContain('Go to dashboard')
    expect(signedInHtml).toContain('/boards')
    expect(signedInHtml).not.toContain('/sign-in')
    expect(signedInHtml).not.toContain('/sign-up')
  })
})
