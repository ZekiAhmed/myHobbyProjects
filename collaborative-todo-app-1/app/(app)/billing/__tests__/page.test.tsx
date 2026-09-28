/**
 * @fileoverview Gate + shell test for the billing history page
 * (subscription-billing issue 06)
 *
 * CONTRACT UNDER TEST (GET /billing, rendered):
 * 1. A signed-out visitor is redirected to /sign-in
 * 2. A signed-in user gets the "Billing history" screen with the
 *    React Query history table mounted (the data itself arrives via
 *    GET /api/billing/submissions — asserted in the component test)
 * 3. Rendering reads only — the page never queries or writes submissions
 *    itself (reads go through the GET route + central query options)
 *
 * The real getRequiredSession gate runs in this test — only the session
 * source, the database, and the Next redirects are mocked at the module
 * boundary (prior art: app/(app)/upgrade/__tests__/page.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redirect } from 'next/navigation'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  paymentSubmission: { findMany: vi.fn(), findFirst: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => sessionMock.getSession() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
  }
})

import BillingPage from '@/app/(app)/billing/page'

function signIn() {
  sessionMock.getSession.mockResolvedValue({
    user: { id: 'user_subscriber', email: 'sub@t.dev', name: 'Test User' },
    session: { id: 's1' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  signIn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('billing history page gate (signed-in users only)', () => {
  it('redirects a signed-out visitor to sign-in without any reads', async () => {
    sessionMock.getSession.mockResolvedValue(null)

    await expect(BillingPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    expect(redirect).toHaveBeenCalledWith('/sign-in')
    expect(prismaMock.paymentSubmission.findMany).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.findFirst).not.toHaveBeenCalled()
  })
})

describe('billing history page content', () => {
  it('renders the Billing history screen with the React Query table mounted', async () => {
    const element = await BillingPage()
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>
    )

    expect(html).toContain('Billing history')
    // the client table mounts in its loading state; its data arrives from
    // GET /api/billing/submissions, never from this server render
    expect(html).toMatch(/loading billing history/i)
    expect(prismaMock.paymentSubmission.findMany).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.findFirst).not.toHaveBeenCalled()
  })
})
