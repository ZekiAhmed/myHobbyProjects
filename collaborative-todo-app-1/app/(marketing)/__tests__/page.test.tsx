/**
 * @fileoverview Landing page content test (full marketing landing)
 *
 * CONTRACT UNDER TEST (GET /, rendered):
 * 1. A signed-out visitor sees the branched hero CTAs (Get started +
 *    Sign in) and no link into the protected dashboard
 * 2. A signed-in visitor sees "Go to dashboard" and no sign-in/sign-up
 *    offers anywhere on the page
 * 3. The Pro price renders live from the settings singleton row (250 ETB
 *    in this fixture), never a hardcoded number
 * 4. A missing settings row falls back to the 100 ETB seed defaults —
 *    rendering reads only (the migration owns the first-run seed)
 * 5. Every section the header/footer nav anchors to exists as an id:
 *    #how-it-works, #features, #pricing
 * 6. The agreed content inventory ships: 3 how-it-works steps, 6
 *    feature cards, Free vs Pro pricing with the bank-transfer footnote,
 *    and the 4-question FAQ with its factual answers
 * 7. Rendering reads the settings row only — no writes
 *
 * Module-boundary mocks: session source, database, next/headers
 * (prior art: app/(app)/upgrade/__tests__/page.test.tsx — the real
 * getOptionalSession runs on purpose).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  pricingSettings: { findUnique: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => sessionMock.getSession() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import LandingPage from '@/app/(marketing)/page'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

const SETTINGS_ROW = {
  id: PRICING_SETTINGS_ID,
  price: 250,
  currency: 'ETB',
  accountHolder: 'Acme Inc',
  accountNumber: '123456789012',
  bankName: 'Awash Bank',
  transferInstructions: 'Include your payment reference in the memo.',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
}

function signIn() {
  sessionMock.getSession.mockResolvedValue({
    user: { id: 'user_1', email: 'u@t.dev', name: 'Test User' },
    session: { id: 's1' },
  })
}

function signOut() {
  sessionMock.getSession.mockResolvedValue(null)
}

/** Renders the landing to static HTML — what the visitor actually sees. */
async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await LandingPage())
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.pricingSettings.findUnique.mockResolvedValue(SETTINGS_ROW)
  signOut()
})

describe('landing CTA branching (session-aware hero)', () => {
  it('shows Get started + Sign in for a signed-out visitor, with no dashboard link', async () => {
    signOut()

    const html = await renderPage()

    expect(html).toContain('Get started')
    expect(html).toContain('Sign in')
    expect(html).toContain('/sign-up')
    expect(html).toContain('/sign-in')
    expect(html).not.toContain('/boards')
  })

  it('shows Go to dashboard for a signed-in visitor, with no sign-in/sign-up offer', async () => {
    signIn()

    const html = await renderPage()

    expect(html).toContain('Go to dashboard')
    expect(html).toContain('/boards')
    expect(html).not.toContain('/sign-in')
    expect(html).not.toContain('/sign-up')
    // the paid moment for a signed-in user points at the upgrade screen
    expect(html).toContain('/upgrade')
    expect(html).toContain('Get Pro')
  })
})

describe('landing pricing section (live price)', () => {
  it('renders the live price/currency from the settings row', async () => {
    signOut()

    const html = await renderPage()

    expect(html).toContain('250 ETB')
    expect(html).toContain('/ month')
    expect(prismaMock.pricingSettings.findUnique).toHaveBeenCalledWith({
      where: { id: PRICING_SETTINGS_ID },
    })
  })

  it('falls back to the 100 ETB seed defaults when the settings row is missing — without writing', async () => {
    signOut()
    prismaMock.pricingSettings.findUnique.mockResolvedValue(null)

    const html = await renderPage()

    expect(html).toContain('100 ETB')
    expect(html).not.toContain('250 ETB')
    // render-only: the page has no write surface at all
    expect(prismaMock.pricingSettings.findUnique).toHaveBeenCalledTimes(1)
  })

  it('pays only price/currency to the render — bank details stay out of the public page', async () => {
    signOut()

    const html = await renderPage()

    expect(html).not.toContain('123456789012')
    expect(html).not.toContain('Acme Inc')
    expect(html).not.toContain('Awash Bank')
    // but the honest footnote about the manual flow is there
    expect(html).toContain('within 24 hours')
    expect(html).toContain('bank transfer')
  })

  it('distinguishes Free from Pro: unlimited personal boards free, invites behind Pro', async () => {
    signOut()

    const html = await renderPage()

    expect(html).toContain('Unlimited personal boards')
    expect(html).toContain('Inviting teammates — Pro only')
    expect(html).toContain('Invite Members to any board you own')
    expect(html).toContain('Members join and use your boards free')
  })
})

describe('landing structure (section anchors)', () => {
  it('exposes every id the header/footer nav anchors to', async () => {
    const html = await renderPage()

    expect(html).toContain('id="how-it-works"')
    expect(html).toContain('id="features"')
    expect(html).toContain('id="pricing"')
  })

  it('ships the agreed section inventory: 3 steps, 6 features, 4 FAQs', async () => {
    const html = await renderPage()

    // how it works — 3 steps
    expect(html).toContain('Create a board')
    expect(html).toContain('Invite your team')
    expect(html).toContain('Ship together')
    // features — the three new cards beyond the original minimal hero
    expect(html).toContain('Comments &amp; activity log')
    expect(html).toContain('Notifications that find you')
    expect(html).toContain('Drag, drop, tag, done')
    // FAQ — the four agreed questions with their factual answers
    expect(html).toContain('Is it free?')
    expect(html).toContain('How does payment work?')
    expect(html).toContain('Does my team need to pay too?')
    expect(html).toContain('What happens if I stop renewing?')
    expect(html).toMatch(/read-only/)
    // final CTA repeats the hero
    expect(html).toContain('Ready to ship together?')
  })

  it('keeps the product preview decorative (aria-hidden), never content', async () => {
    const html = await renderPage()

    expect(html).toMatch(/aria-hidden="true"/)
    // the preview's live sync readout (the product's real 8s cadence)
    expect(html).toContain('Sync')
    expect(html).toContain('08s')
    // and the three columns framing the demo cards
    expect(html).toContain('To Do')
    expect(html).toContain('In Progress')
    expect(html).toContain('Done')
  })
})
