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
  generatePaymentReference,
} from '../subscription'

describe('subscription date & entitlement math', () => {
  describe('addCalendarMonth', () => {
    it('clamps Jan 31 to Feb 28 in a non-leap year, keeping the time of day', () => {
      expect(addCalendarMonth(new Date(2026, 0, 31, 14, 30))).toEqual(
        new Date(2026, 1, 28, 14, 30)
      )
    })

    it('clamps Jan 31 to Feb 29 in a leap year', () => {
      expect(addCalendarMonth(new Date(2028, 0, 31))).toEqual(new Date(2028, 1, 29))
    })

    it('clamps Mar 31 to Apr 30 (30-day month)', () => {
      expect(addCalendarMonth(new Date(2026, 2, 31))).toEqual(new Date(2026, 3, 30))
    })

    it('rolls Dec 31 into Jan 31 of the next year', () => {
      expect(addCalendarMonth(new Date(2026, 11, 31))).toEqual(new Date(2027, 0, 31))
    })

    it('advances Feb 28 to Mar 28 in a non-leap year (no rollover to Mar 1)', () => {
      expect(addCalendarMonth(new Date(2026, 1, 28))).toEqual(new Date(2026, 2, 28))
    })

    it('advances Feb 29 to Mar 29 in a leap year (no rollover to Mar 1)', () => {
      expect(addCalendarMonth(new Date(2028, 1, 29))).toEqual(new Date(2028, 2, 29))
    })

    it('keeps a mid-month day and never mutates the input', () => {
      const input = new Date(2026, 3, 15, 9, 15)
      const result = addCalendarMonth(input)
      expect(result).toEqual(new Date(2026, 4, 15, 9, 15))
      expect(input).toEqual(new Date(2026, 3, 15, 9, 15))
      expect(result).not.toBe(input)
    })
  })

  describe('computePeriodEnd', () => {
    it('stacks one month onto the current end while the period is active', () => {
      const now = new Date(2026, 4, 10, 12)
      const currentEnd = new Date(2026, 4, 25, 8)
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(2026, 5, 25, 8))
    })

    it('starts a fresh month at approval when the previous period lapsed', () => {
      const now = new Date(2026, 4, 10, 12)
      const lapsedEnd = new Date(2026, 3, 25, 8)
      expect(computePeriodEnd(now, lapsedEnd)).toEqual(new Date(2026, 5, 10, 12))
    })

    it('starts a fresh month at approval when there is no previous period', () => {
      const now = new Date(2026, 4, 10, 12)
      expect(computePeriodEnd(now, null)).toEqual(new Date(2026, 5, 10, 12))
    })

    it('stacks from approval when renewal lands exactly on the current end', () => {
      const now = new Date(2026, 4, 25, 8)
      const currentEnd = new Date(2026, 4, 25, 8)
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(2026, 5, 25, 8))
    })

    it('clamps the stacked end when the current end falls on Jan 31', () => {
      const now = new Date(2027, 0, 20)
      const currentEnd = new Date(2027, 0, 31)
      expect(computePeriodEnd(now, currentEnd)).toEqual(new Date(2027, 1, 28))
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
