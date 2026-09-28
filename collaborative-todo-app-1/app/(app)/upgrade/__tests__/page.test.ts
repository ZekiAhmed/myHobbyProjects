/**
 * @fileoverview Gate + content test for the upgrade screen
 * (subscription-billing issue 04)
 *
 * CONTRACT UNDER TEST (GET /upgrade, rendered):
 * 1. A signed-out visitor is redirected to /sign-in without any reads
 * 2. A free user with no open attempt sees the live price/currency from
 *    the settings record and the Subscribe CTA — and no instruction card
 * 3. A missing settings row falls back to the 100 ETB seed defaults —
 *    rendering never writes (the migration owns the first-run seed)
 * 4. With a live AWAITING_UPLOAD attempt the screen shows the payment
 *    instruction card instead of the CTA: reference, snapshotted amount,
 *    and the current bank details/transfer instructions from settings
 * 5. A stale attempt (48h TTL passed) does NOT render the card — the
 *    Subscribe CTA is back, so an abandoned attempt never locks the
 *    screen (the EXPIRED flip happens inside the subscribe action)
 * 6. A PENDING attempt shows a "under review" note with its reference,
 *    never a second Subscribe CTA
 * 7. Rendering reads only — no submission is created or updated here
 *
 * The real getRequiredSession gate runs in this test — only the session
 * source, the database, and the Next redirects are mocked at the module
 * boundary (prior art: app/(app)/admin/__tests__/page.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redirect } from 'next/navigation'
import { renderToStaticMarkup } from 'react-dom/server'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const refreshMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  pricingSettings: { findUnique: vi.fn() },
  paymentSubmission: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
    // the client Subscribe button lives in this tree; it only needs the
    // router hook to exist during the static render
    useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
  }
})

import UpgradePage from '@/app/(app)/upgrade/page'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

const USER_ID = 'user_free'
const NOW = new Date('2026-09-28T12:00:00.000Z')

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

const LIVE_ATTEMPT = {
  id: 'sub_live',
  userId: USER_ID,
  reference: 'PAY-LIVE-0001',
  status: 'AWAITING_UPLOAD' as const,
  // deliberately different from the live settings price (250): the card
  // must show the snapshot, so a price edit never moves the goalposts
  priceSnapshot: 175,
  currencySnapshot: 'ETB',
  expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
  createdAt: NOW,
  updatedAt: NOW,
}

function signIn(userId = USER_ID) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: 's1' },
  })
}

/** Renders the upgrade screen to static HTML — what the user actually sees. */
async function renderScreen(): Promise<string> {
  const el = await UpgradePage()
  return renderToStaticMarkup(el)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  prismaMock.pricingSettings.findUnique.mockResolvedValue(SETTINGS_ROW)
  prismaMock.paymentSubmission.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('upgrade screen gate (signed-in users only)', () => {
  it('redirects a signed-out visitor to sign-in without any reads', async () => {
    sessionMock.getSession.mockResolvedValue(null)

    await expect(UpgradePage()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    expect(redirect).toHaveBeenCalledWith('/sign-in')
    expect(prismaMock.pricingSettings.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.findFirst).not.toHaveBeenCalled()
  })
})

describe('upgrade screen content (payment instruction card)', () => {
  it('shows the live price/currency from settings and the Subscribe CTA when there is no open attempt', async () => {
    signIn()

    const html = await renderScreen()

    expect(html).toContain('250')
    expect(html).toContain('ETB')
    expect(html).toContain('Subscribe')
    // no instruction card without an attempt
    expect(html).not.toContain('PAY-LIVE-0001')
  })

  it('falls back to the 100 ETB seed defaults when the settings row is missing — without writing', async () => {
    signIn()
    prismaMock.pricingSettings.findUnique.mockResolvedValue(null)

    const html = await renderScreen()

    expect(html).toContain('100')
    expect(html).toContain('ETB')
    expect(prismaMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('replaces the CTA with the instruction card for a live attempt: reference, snapshot, bank details', async () => {
    signIn()
    prismaMock.paymentSubmission.findFirst.mockResolvedValue(LIVE_ATTEMPT)

    const html = await renderScreen()

    expect(html).toContain('PAY-LIVE-0001')
    // the attempt's own snapshotted amount (175) — NOT the live price (250)
    expect(html).toContain('175 ETB')
    // bank details + transfer instructions from settings
    expect(html).toContain('Awash Bank')
    expect(html).toContain('123456789012')
    expect(html).toContain('Include your payment reference in the memo.')
    // no second CTA while one attempt is live
    expect(html).not.toContain('Subscribe')
    // reading is read-only
    expect(prismaMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('brings the Subscribe CTA back when the attempt is stale (48h TTL passed) — rendering never flips it', async () => {
    signIn()
    prismaMock.paymentSubmission.findFirst.mockResolvedValue({
      ...LIVE_ATTEMPT,
      id: 'sub_stale',
      reference: 'PAY-STAL-0009',
      expiresAt: new Date(NOW.getTime() - 1000),
    })

    const html = await renderScreen()

    // the stale row is not rendered as a live card…
    expect(html).not.toContain('PAY-STAL-0009')
    // …and the user can start again from this very screen
    expect(html).toContain('Subscribe')
    // the EXPIRED flip belongs to the subscribe action, not the render
    expect(prismaMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('shows an under-review note for a PENDING attempt instead of a second Subscribe CTA', async () => {
    signIn()
    prismaMock.paymentSubmission.findFirst.mockResolvedValue({
      ...LIVE_ATTEMPT,
      id: 'sub_pending',
      reference: 'PAY-REVW-0002',
      status: 'PENDING' as const,
    })

    const html = await renderScreen()

    expect(html).toContain('PAY-REVW-0002')
    expect(html).toMatch(/under review/i)
    expect(html).not.toContain('Subscribe')
  })
})
