/**
 * @fileoverview Tests for subscription date & entitlement math —
 * the pure helpers of subscription-billing issue 03 (seam: pure
 * library functions; prior art lib/__tests__/invite-tokens.test.ts).
 *
 * Expected values are worked examples from the spec (clamps, stacking,
 * boundary instants), never recomputed the way the implementation
 * computes them.
 */

import { describe, it, expect } from 'vitest'
import {
  addCalendarMonth,
  computePeriodEnd,
  deriveSubscription,
  formatRenewalDate,
  generatePaymentReference,
  isProSubscriber,
  deriveBoardWriteLock,
} from '../subscription'

describe('subscription date & entitlement math', () => {
  // FIXTURES ARE CONSTRUCTED IN UTC: the arithmetic runs on the UTC
  // calendar (addCalendarMonth/formatRenewalDate), so examples built
  // with local `new Date(y, m, d)` would describe a different day on a
  // server whose zone differs from UTC — the worked examples below must
  // hold in ANY time zone the suite is run in.
  describe('addCalendarMonth', () => {
    it('clamps Jan 31 to Feb 28 in a non-leap year, keeping the time of day', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2026, 0, 31, 14, 30)))).toEqual(
        new Date(Date.UTC(2026, 1, 28, 14, 30))
      )
    })

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2028, 0, 31)))).toEqual(
        new Date(Date.UTC(2028, 1, 29))
      )
    })

    it('clamps Mar 31 to Apr 30 (30-day month)', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2026, 2, 31)))).toEqual(
        new Date(Date.UTC(2026, 3, 30))
      )
    })

    it('rolls Dec 31 into Jan 31 of the next year', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2026, 11, 31)))).toEqual(
        new Date(Date.UTC(2027, 0, 31))
      )
    })

    it('advances Feb 28 to Mar 28 in a non-leap year (no rollover to Mar 1)', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2026, 1, 28)))).toEqual(
        new Date(Date.UTC(2026, 2, 28))
      )
    })

    it('advances Feb 29 to Mar 29 in a leap year (no rollover to Mar 1)', () => {
      expect(addCalendarMonth(new Date(Date.UTC(2028, 1, 29)))).toEqual(
        new Date(Date.UTC(2028, 2, 29))
      )
    })

    it('keeps a mid-month day and never mutates the input', () => {
      const input = new Date(Date.UTC(2026, 3, 15, 9, 15))
      const result = addCalendarMonth(input)
      expect(result).toEqual(new Date(Date.UTC(2026, 4, 15, 9, 15)))
      expect(input).toEqual(new Date(Date.UTC(2026, 3, 15, 9, 15)))
      expect(result).not.toBe(input)
    })
  })

  describe('computePeriodEnd', () => {
    it('stacks one month onto the current end while the period is active', () => {
      const now = new Date(Date.UTC(2026, 4, 10, 12))
      const currentEnd = new Date(Date.UTC(2026, 4, 25, 8))
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(Date.UTC(2026, 5, 25, 8)))
    })

    it('starts a fresh month at approval when the previous period lapsed', () => {
      const now = new Date(Date.UTC(2026, 4, 10, 12))
      const lapsedEnd = new Date(Date.UTC(2026, 3, 25, 8))
      expect(computePeriodEnd(now, lapsedEnd)).toEqual(new Date(Date.UTC(2026, 5, 10, 12)))
    })

    it('starts a fresh month at approval when there is no previous period', () => {
      const now = new Date(Date.UTC(2026, 4, 10, 12))
      expect(computePeriodEnd(now, null)).toEqual(new Date(Date.UTC(2026, 5, 10, 12)))
    })

    it('stacks from approval when renewal lands exactly on the current end', () => {
      const now = new Date(Date.UTC(2026, 4, 25, 8))
      const currentEnd = new Date(Date.UTC(2026, 4, 25, 8))
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(Date.UTC(2026, 5, 25, 8)))
    })

    it('clamps the stacked end when the current end falls on Jan 31', () => {
      const now = new Date(Date.UTC(2027, 0, 20))
      const currentEnd = new Date(Date.UTC(2027, 0, 31))
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(Date.UTC(2027, 1, 28)))
    })

    it('clamps from an end stored at UTC midnight — the case a local-calendar run got wrong', () => {
      // 31 Jan 00:00 UTC read on a west-of-UTC server is still 31 Jan in
      // the only zone billing uses; the clamp must land on 28 Feb 00:00
      // UTC, so formatRenewalDate then says "28 February" everywhere.
      const periodEnd = computePeriodEnd(
        new Date(Date.UTC(2027, 0, 20)),
        new Date(Date.UTC(2027, 0, 31))
      )
      expect(periodEnd).toEqual(new Date(Date.UTC(2027, 1, 28)))
      expect(formatRenewalDate(periodEnd)).toBe('28 February')
    })
  })

  describe('formatRenewalDate — the calendar date every surface renders', () => {
    it('renders a period end as a clamped calendar date, never a day counter', () => {
      expect(formatRenewalDate(new Date(Date.UTC(2026, 2, 25, 8, 30)))).toBe('25 March')
    })

    it('renders the clamped stacked end exactly as it was stored (Jan 31 → 28 February)', () => {
      const periodEnd = computePeriodEnd(new Date(Date.UTC(2027, 0, 20)), new Date(Date.UTC(2027, 0, 31)))
      expect(formatRenewalDate(periodEnd)).toBe('28 February')
    })

    it('renders a single-digit day without padding (1 March)', () => {
      expect(formatRenewalDate(new Date(Date.UTC(2026, 2, 1)))).toBe('1 March')
    })

    it('ignores time of day and reads the date in UTC, so server and client never disagree', () => {
      // 23:30 UTC on 30 June — local-time rendering east of UTC would
      // already say 1 July, moving the renewal date by a whole day
      expect(formatRenewalDate(new Date(Date.UTC(2026, 5, 30, 23, 30)))).toBe('30 June')
    })

    it('renders December of the previous year boundary without rolling', () => {
      expect(formatRenewalDate(new Date(Date.UTC(2026, 11, 31, 23, 59)))).toBe('31 December')
    })
  })

  describe('deriveSubscription', () => {
    const dayMs = 24 * 60 * 60 * 1000

    it('returns none when the user has never had a period end', () => {
      expect(deriveSubscription(null, new Date(2026, 4, 10))).toEqual({
        state: 'none',
        expiringSoon: false,
      })
    })

    it('returns active before expiry without the warning flag when far from expiry', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(deriveSubscription(periodEnd, new Date(2026, 4, 10))).toEqual({
        state: 'active',
        expiringSoon: false,
      })
    })

    it('returns active one millisecond before expiry', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(deriveSubscription(periodEnd, new Date(periodEnd.getTime() - 1))).toEqual({
        state: 'active',
        expiringSoon: true,
      })
    })

    it('returns expired at the exact expiry instant, with no warning flag', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(deriveSubscription(periodEnd, periodEnd)).toEqual({
        state: 'expired',
        expiringSoon: false,
      })
    })

    it('returns expired after the expiry instant', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(deriveSubscription(periodEnd, new Date(periodEnd.getTime() + 1))).toEqual({
        state: 'expired',
        expiringSoon: false,
      })
    })

    it('sets the warning flag at exactly seven days before expiry', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(deriveSubscription(periodEnd, new Date(periodEnd.getTime() - 7 * dayMs))).toEqual({
        state: 'active',
        expiringSoon: true,
      })
    })

    it('clears the warning flag one millisecond beyond seven days before expiry', () => {
      const periodEnd = new Date(2026, 4, 25)
      expect(
        deriveSubscription(periodEnd, new Date(periodEnd.getTime() - 7 * dayMs - 1))
      ).toEqual({
        state: 'active',
        expiringSoon: false,
      })
    })
  })

  describe('isProSubscriber — the single entitlement check', () => {
    const periodEnd = new Date(2026, 4, 25)

    it('answers Pro while the paid period is running', () => {
      expect(isProSubscriber(periodEnd, new Date(2026, 4, 10))).toBe(true)
    })

    it('answers Pro one millisecond before the period ends', () => {
      expect(isProSubscriber(periodEnd, new Date(periodEnd.getTime() - 1))).toBe(true)
    })

    it('stops answering Pro at the exact expiry instant (no grace period)', () => {
      expect(isProSubscriber(periodEnd, periodEnd)).toBe(false)
    })

    it('answers not-Pro after expiry', () => {
      expect(isProSubscriber(periodEnd, new Date(periodEnd.getTime() + 1))).toBe(false)
    })

    it('answers not-Pro when the user never had a period', () => {
      expect(isProSubscriber(null, new Date(2026, 4, 10))).toBe(false)
    })
  })

  describe('deriveBoardWriteLock — Boards with Members at expiry', () => {
    const periodEnd = new Date(2026, 4, 25)

    it('locks a Board with Members at the exact expiry instant, naming the lapse', () => {
      expect(
        deriveBoardWriteLock({ hasMembers: true, ownerPeriodEnd: periodEnd, now: periodEnd })
      ).toEqual({ locked: true, reason: 'expired' })
    })

    it('locks a Board with Members after expiry', () => {
      expect(
        deriveBoardWriteLock({
          hasMembers: true,
          ownerPeriodEnd: periodEnd,
          now: new Date(periodEnd.getTime() + 1),
        })
      ).toEqual({ locked: true, reason: 'expired' })
    })

    it('leaves a Board with Members writable one millisecond before expiry', () => {
      expect(
        deriveBoardWriteLock({
          hasMembers: true,
          ownerPeriodEnd: periodEnd,
          now: new Date(periodEnd.getTime() - 1),
        })
      ).toEqual({ locked: false, reason: null })
    })

    it('leaves a Board with Members writable for a Pro subscriber', () => {
      expect(
        deriveBoardWriteLock({
          hasMembers: true,
          ownerPeriodEnd: periodEnd,
          now: new Date(2026, 4, 10),
        })
      ).toEqual({ locked: false, reason: null })
    })

    it('locks a Board with Members whose Owner never subscribed, naming that fact', () => {
      expect(deriveBoardWriteLock({ hasMembers: true, ownerPeriodEnd: null, now: new Date() })).toEqual({
        locked: true,
        reason: 'none',
      })
    })

    it('leaves a Board without Members writable after expiry — the free tier keeps solo work editable', () => {
      expect(
        deriveBoardWriteLock({
          hasMembers: false,
          ownerPeriodEnd: periodEnd,
          now: new Date(periodEnd.getTime() + 1),
        })
      ).toEqual({ locked: false, reason: null })
    })

    it('leaves a Board without Members writable for a user who never subscribed', () => {
      expect(
        deriveBoardWriteLock({ hasMembers: false, ownerPeriodEnd: null, now: new Date() })
      ).toEqual({ locked: false, reason: null })
    })

    it('leaves a Board without Members writable while the Owner is Pro', () => {
      expect(
        deriveBoardWriteLock({
          hasMembers: false,
          ownerPeriodEnd: periodEnd,
          now: new Date(2026, 4, 10),
        })
      ).toEqual({ locked: false, reason: null })
    })
  })

  describe('generatePaymentReference', () => {
    it('generates a user-friendly reference without ambiguous characters', () => {
      const reference = generatePaymentReference()
      expect(reference).toMatch(/^PAY-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
    })

    it('generates unique references across many submissions', () => {
      const references = new Set<string>()
      for (let i = 0; i < 50_000; i++) {
        references.add(generatePaymentReference())
      }
      expect(references.size).toBe(50_000)
    })
  })
})
