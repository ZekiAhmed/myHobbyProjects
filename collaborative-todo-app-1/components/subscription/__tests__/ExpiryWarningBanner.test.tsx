/**
 * @fileoverview T-7 expiry warning banner tests
 * (subscription-billing issue 11)
 *
 * CONTRACT UNDER TEST (ExpiryWarningBanner):
 * 1. Renders nothing without a period end — a free user and a team
 *    Member never see a subscription warning (story 28: subscriber only)
 * 2. Renders nothing while the period is healthy (more than 7 days out)
 *    and nothing once the period has ended
 * 3. Renders at exactly 7 days remaining (inclusive boundary) carrying
 *    the CLAMPED CALENDAR date — "renews 5 October" — never a day
 *    counter (stories 28 + 33)
 * 4. Offers the renewal path: the banner links to /upgrade
 *
 * `now` comes from the clock, so this suite pins it with fake timers —
 * the same convention the pure helpers use by taking `now` as a
 * parameter (prior art: app/(app)/upgrade/__tests__/page.test.tsx).
 *
 * Rendered with renderToStaticMarkup in the node environment: the
 * banner is a pure server component with no reads of its own (the
 * layout hands it the signed-in subscriber's period end).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExpiryWarningBanner } from '@/components/subscription/ExpiryWarningBanner'
import { computePeriodEnd } from '@/lib/subscription'

const NOW = new Date('2026-09-28T12:00:00.000Z')
const dayMs = 24 * 60 * 60 * 1000

function render(periodEnd: Date | null): string {
  return renderToStaticMarkup(<ExpiryWarningBanner periodEnd={periodEnd} />)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ExpiryWarningBanner — visibility conditions', () => {
  it('renders nothing for a user with no period end (free user / team Member)', () => {
    expect(render(null)).toBe('')
  })

  it('renders nothing while more than seven days of the period remain', () => {
    expect(render(new Date(NOW.getTime() + 30 * dayMs))).toBe('')
  })

  it('renders nothing one millisecond beyond the seven-day window', () => {
    expect(render(new Date(NOW.getTime() + 7 * dayMs + 1))).toBe('')
  })

  it('renders at exactly seven days remaining — the boundary is inclusive', () => {
    const html = render(new Date(NOW.getTime() + 7 * dayMs))

    expect(html).toContain('renews 5 October')
  })

  it('renders with three days remaining', () => {
    const html = render(new Date(NOW.getTime() + 3 * dayMs))

    expect(html).toContain('renews 1 October')
  })

  it('renders nothing at the exact expiry instant — the period has ended', () => {
    expect(render(new Date(NOW.getTime()))).toBe('')
  })

  it('renders nothing once the period has lapsed', () => {
    expect(render(new Date(NOW.getTime() - dayMs))).toBe('')
  })
})

describe('ExpiryWarningBanner — what it tells the subscriber', () => {
  it('states the clamped calendar renewal date, never a day counter', () => {
    const html = render(new Date(NOW.getTime() + 3 * dayMs))

    expect(html).toContain('renews 1 October')
    expect(html).not.toMatch(/\b\d+\s+days?\b/i)
    expect(html).not.toContain('in 3 days')
  })

  it('offers the renewal path to the upgrade screen', () => {
    const html = render(new Date(NOW.getTime() + 3 * dayMs))

    expect(html).toContain('href="/upgrade"')
  })

  it('is an informational region, not a blocking dialog', () => {
    const html = render(new Date(NOW.getTime() + 3 * dayMs))

    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="dialog"')
  })

  it('shows the date an approval produced, once that date is seven days out', () => {
    // approved 1 September with no prior period → the clock ran to
    // 1 October (issue 03/07 arithmetic); with 3 days left the
    // subscriber is warned against that exact date
    const approvedAt = new Date('2026-09-01T00:00:00.000Z')
    const periodEnd = computePeriodEnd(approvedAt, null)

    const html = render(periodEnd)

    expect(periodEnd).toEqual(new Date('2026-10-01T00:00:00.000Z'))
    expect(html).toContain('renews 1 October')
  })
})
