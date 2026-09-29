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
 * 8. (issue 06) A PENDING attempt renders the waiting-experience status
 *    card: the canonical 24-hour promise copy, the reference, the
 *    snapshotted amount, no pay CTA — and the rest of the screen keeps
 *    working (non-blocking), with an entry point into billing history
 * 9. (issue 11) The pay CTA depends on entitlement: a subscriber whose
 *    period is running sees "Extend by 1 month" plus the clamped
 *    CALENDAR renewal date, while a lapsed or never-subscribed user
 *    sees the plain Subscribe CTA — the arithmetic of an approved
 *    renewal (computePeriodEnd) is what the screen then renders
 *
 * The real getRequiredSession gate runs in this test — only the session
 * source, the database, and the Next redirects are mocked at the module
 * boundary (prior art: app/(app)/admin/__tests__/page.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redirect } from 'next/navigation'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const refreshMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  pricingSettings: { findUnique: vi.fn() },
  paymentSubmission: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
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
import { computePeriodEnd, formatRenewalDate } from '@/lib/subscription'

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

/** Signs the default user in with a given subscription period end. */
function signInWithPeriodEnd(periodEnd: Date | null) {
  signIn()
  prismaMock.user.findUnique.mockResolvedValue({ subscriptionPeriodEnd: periodEnd })
}

/** Renders the upgrade screen to static HTML — what the user actually sees. */
async function renderScreen(): Promise<string> {
  const el = await UpgradePage()
  // the receipt upload form (issue 05) reads TanStack Query for the
  // post-upload billing invalidation (issue 06), so the static render
  // needs the same provider the app shell supplies
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  prismaMock.pricingSettings.findUnique.mockResolvedValue(SETTINGS_ROW)
  prismaMock.paymentSubmission.findFirst.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue({ subscriptionPeriodEnd: null })
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
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
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

describe('upgrade screen waiting experience (issue 06)', () => {
  it('swaps the pay CTA for the status card carrying the 24-hour promise, reference, and amount', async () => {
    signIn()
    prismaMock.paymentSubmission.findFirst.mockResolvedValue({
      ...LIVE_ATTEMPT,
      id: 'sub_pending',
      reference: 'PAY-REVW-0002',
      status: 'PENDING' as const,
    })

    const html = await renderScreen()

    // the canonical waiting copy, verbatim (spec story 12 + ticket 06)
    expect(html).toContain('Receipt submitted — awaiting review, within 24 hours.')
    expect(html).toContain('PAY-REVW-0002')
    // the snapshotted amount travels with the status, never the live price
    expect(html).toContain('175 ETB')
    // the pay CTA is gone while the submission is under review
    expect(html).not.toContain('Subscribe')
  })

  it('keeps the screen non-blocking while pending: page content is unchanged and nothing is written', async () => {
    signIn()
    prismaMock.paymentSubmission.findFirst.mockResolvedValue({
      ...LIVE_ATTEMPT,
      id: 'sub_pending',
      reference: 'PAY-REVW-0002',
      status: 'PENDING' as const,
    })

    const html = await renderScreen()

    // the pricing section still renders — waiting never costs access
    expect(html).toContain('One subscription, your whole team')
    expect(html).toContain('Invite Members to any Board you own')
    // reads only: rendering never creates or flips a submission
    expect(prismaMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.update).not.toHaveBeenCalled()
  })

  it('offers a way into billing history from the screen', async () => {
    signIn()

    const html = await renderScreen()

    expect(html).toContain('/billing')
  })
})

describe('upgrade screen renewal CTA (issue 11)', () => {
  it('offers "Extend by 1 month" to a subscriber whose period is running, with the calendar renewal date', async () => {
    signInWithPeriodEnd(new Date('2026-10-15T00:00:00.000Z'))

    const html = await renderScreen()

    expect(html).toContain('Extend by 1 month')
    expect(html).toContain('renews 15 October')
    // the plain Subscribe CTA is gone while Pro is active — extending
    // is the only paid moment on this screen
    expect(html).not.toContain('Subscribe')
    // the renewal path starts a receipt too, so it carries the same
    // review promise (spec §Money: the upgrade UI promises review
    // within 24 hours) — extending must not read as a faster lane
    expect(html).toContain('within 24 hours')
    // a calendar date, never a drifting counter (spec story 33)
    expect(html).not.toMatch(/\b\d+\s+days?\b/i)
  })

  it('keeps the plain Subscribe CTA for a lapsed subscriber — renewal is offered, not assumed', async () => {
    signInWithPeriodEnd(new Date('2026-09-01T00:00:00.000Z'))

    const html = await renderScreen()

    expect(html).toContain('Subscribe')
    expect(html).not.toContain('Extend by 1 month')
  })

  it('keeps the plain Subscribe CTA for a user who never subscribed', async () => {
    signInWithPeriodEnd(null)

    const html = await renderScreen()

    expect(html).toContain('Subscribe')
    expect(html).not.toContain('Extend by 1 month')
  })

  it('renders the stacked period an approved early renewal produced — approval arithmetic reaches the screen', async () => {
    // an active period ending 15 October, approved NOW (issue 07):
    // the new month stacks onto the current end → 15 November, and the
    // screen shows that date with the extend CTA
    const currentEnd = new Date('2026-10-15T00:00:00.000Z')
    const stackedEnd = computePeriodEnd(NOW, currentEnd)
    expect(stackedEnd).toEqual(new Date('2026-11-15T00:00:00.000Z'))

    signInWithPeriodEnd(stackedEnd)

    const html = await renderScreen()

    expect(html).toContain('Extend by 1 month')
    expect(html).toContain(`renews ${formatRenewalDate(stackedEnd)}`)
    expect(html).toContain('renews 15 November')
  })

  it('does not offer an extension while an attempt is under review — one attempt at a time still holds', async () => {
    signInWithPeriodEnd(new Date('2026-10-15T00:00:00.000Z'))
    prismaMock.paymentSubmission.findFirst.mockResolvedValue({
      ...LIVE_ATTEMPT,
      id: 'sub_pending',
      reference: 'PAY-REVW-0002',
      status: 'PENDING' as const,
    })

    const html = await renderScreen()

    expect(html).toContain('PAY-REVW-0002')
    expect(html).not.toContain('Extend by 1 month')
    expect(html).not.toContain('Subscribe')
  })

  it('reads only — rendering the CTA never writes a submission', async () => {
    signInWithPeriodEnd(new Date('2026-10-15T00:00:00.000Z'))

    await renderScreen()

    expect(prismaMock.paymentSubmission.create).not.toHaveBeenCalled()
    expect(prismaMock.paymentSubmission.update).not.toHaveBeenCalled()
  })
})
