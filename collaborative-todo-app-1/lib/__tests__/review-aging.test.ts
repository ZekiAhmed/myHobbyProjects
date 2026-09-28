/**
 * @fileoverview Aging-badge contract for the admin review queue
 * (subscription-billing issue 07)
 *
 * CONTRACT UNDER TEST (reviewAgeBadge):
 * 1. Inside the 24-hour promise the badge counts down in whole hours,
 *    rounding DOWN so it never claims more time than is left ("18h left")
 * 2. The last hour switches to minutes so the badge stays useful as the
 *    deadline closes in — never "0m left" while time remains
 * 3. At exactly 24 hours elapsed the badge is OVERDUE — the boundary is
 *    the promise itself, and one millisecond earlier is still "left"
 * 4. A submission time in the future (app-server clock skew) clamps to
 *    the full window instead of inventing time beyond the promise
 * 5. The function is pure: the badge depends only on its two arguments,
 *    never on a hidden clock
 */

import { describe, it, expect } from 'vitest'
import { reviewAgeBadge, REVIEW_WINDOW_MS } from '@/lib/review-aging'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** A fixed "now" so every expectation is exact, not timing-dependent. */
const NOW = new Date('2026-09-28T12:00:00.000Z')

function submittedAgo(ms: number): Date {
  return new Date(NOW.getTime() - ms)
}

describe('reviewAgeBadge — countdown inside the 24-hour window', () => {
  it('reads "18h left" six hours after submission (the spec example)', () => {
    expect(reviewAgeBadge(submittedAgo(6 * HOUR), NOW)).toEqual({
      label: '18h left',
      overdue: false,
    })
  })

  it('starts at the full window the instant the receipt lands', () => {
    expect(reviewAgeBadge(NOW, NOW)).toEqual({ label: '24h left', overdue: false })
  })

  it('rounds hours down so the badge never claims more time than is left', () => {
    // 17h30m remaining reads "17h left": rounding down can only make the
    // Administrator act earlier than the deadline, never later.
    expect(reviewAgeBadge(submittedAgo(6 * HOUR + 30 * MINUTE), NOW).label).toBe('17h left')
    // 1h01m remaining still counts as hours, at the honest floor of 1
    expect(reviewAgeBadge(submittedAgo(22 * HOUR + 59 * MINUTE), NOW).label).toBe('1h left')
  })

  it('switches to minutes for the final hour', () => {
    expect(reviewAgeBadge(submittedAgo(23 * HOUR + 15 * MINUTE), NOW)).toEqual({
      label: '45m left',
      overdue: false,
    })
    // floor again — 45m30s left is 45 minutes, not 46
    expect(reviewAgeBadge(submittedAgo(23 * HOUR + 14 * MINUTE + 30 * 1000), NOW).label).toBe(
      '45m left'
    )
    // one second left still shows a whole minute, never "0m left"
    expect(reviewAgeBadge(submittedAgo(24 * HOUR - 1000), NOW).label).toBe('1m left')
  })
})

describe('reviewAgeBadge — the OVERDUE boundary', () => {
  it('is not overdue one millisecond before the promise expires', () => {
    expect(reviewAgeBadge(submittedAgo(REVIEW_WINDOW_MS - 1), NOW)).toEqual({
      label: '1m left',
      overdue: false,
    })
  })

  it('is OVERDUE at exactly 24 hours elapsed', () => {
    expect(reviewAgeBadge(submittedAgo(REVIEW_WINDOW_MS), NOW)).toEqual({
      label: 'OVERDUE',
      overdue: true,
    })
  })

  it('stays OVERDUE well past the window — a stale queue keeps shouting', () => {
    expect(reviewAgeBadge(submittedAgo(30 * HOUR), NOW)).toEqual({
      label: 'OVERDUE',
      overdue: true,
    })
  })
})

describe('reviewAgeBadge — purity and clock skew', () => {
  it('clamps a future submission time to the full window', () => {
    const future = new Date(NOW.getTime() + 5 * HOUR)

    expect(reviewAgeBadge(future, NOW)).toEqual({ label: '24h left', overdue: false })
  })

  it('is a pure function of its arguments — same inputs, same badge', () => {
    const submitted = submittedAgo(6 * HOUR)

    expect(reviewAgeBadge(submitted, NOW)).toEqual(reviewAgeBadge(submitted, NOW))
  })
})
