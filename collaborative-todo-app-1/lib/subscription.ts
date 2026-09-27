/**
 * @fileoverview Subscription date & entitlement math — pure functions
 * (subscription-billing issue 03)
 *
 * The arithmetic heart of billing: every later ticket composes these
 * proven pieces (period stacking on approval, lazily derived Pro state,
 * the T-7 warning, payment references).
 *
 * STRICTLY PURE: no database, no network, no clock reads — callers pass
 * `now` explicitly so state is reproducible and testable. The only
 * effectful call is crypto randomness in generatePaymentReference (no
 * I/O beyond the OS entropy pool, same as lib/utils/invite-tokens.ts).
 *
 * Domain rules implemented here (spec §Domain & entitlement and
 * §Money & subscription period):
 * - Period length = one calendar month, clamped (Jan 31 → Feb 28/29,
 *   never rolls into March).
 * - Early renewal stacks: periodEnd = max(now, currentPeriodEnd) + 1
 *   month, so a paying subscriber never falls into a locked gap.
 * - Derived state (none / active / expired) is computed at read time
 *   from the period end — no cron, no grace period. The period has
 *   ended at exactly periodEnd, so expiry bites at the instant itself.
 */

import crypto from 'crypto'

/** Days before expiry at which the T-7 warning banner appears. */
export const EXPIRY_WARNING_DAYS = 7

/**
 * Adds one calendar month to `date`, clamping the day of month to the
 * last day of the target month (Jan 31 → Feb 28 in a non-leap year,
 * Jan 31 2028 → Feb 29 2028). Time of day is preserved; the input is
 * never mutated.
 */
export function addCalendarMonth(date: Date): Date {
  const result = new Date(date)
  const nextMonth = result.getMonth() + 1
  const year = result.getFullYear() + Math.floor(nextMonth / 12)
  const month = nextMonth % 12
  const daysInTargetMonth = new Date(year, month + 1, 0).getDate()
  result.setFullYear(year, month, Math.min(result.getDate(), daysInTargetMonth))
  return result
}

/**
 * Computes the period end after an approval/renewal at `approvedAt`.
 *
 * Stacked renewal (spec §Money & subscription period):
 * `periodEnd = max(approvedAt, currentPeriodEnd) + 1 calendar month`.
 * An active period extends from its own end so the subscriber never
 * loses paid time; a lapsed period (or no period at all, i.e. `null`)
 * starts the new month at the approval instant.
 */
export function computePeriodEnd(approvedAt: Date, currentPeriodEnd: Date | null): Date {
  const anchor =
    currentPeriodEnd !== null && currentPeriodEnd > approvedAt ? currentPeriodEnd : approvedAt
  return addCalendarMonth(anchor)
}

/** Derived subscription state: no period, running period, or lapsed. */
export type SubscriptionState = 'none' | 'active' | 'expired'

/** What the app needs to render: state plus the T-7 warning flag. */
export interface SubscriptionStatus {
  state: SubscriptionState
  expiringSoon: boolean
}

/**
 * Lazily derives subscription state from the stored period end and the
 * caller-supplied current time — no cron, no stored status, no grace
 * period. The period has ended AT `periodEnd` itself: exactly at that
 * instant the state is `expired` (spec: "at expiry, Boards with Members
 * become read-only").
 */
export function deriveSubscription(periodEnd: Date | null, now: Date): SubscriptionStatus {
  if (periodEnd === null) {
    return { state: 'none', expiringSoon: false }
  }

  if (now < periodEnd) {
    const msUntilExpiry = periodEnd.getTime() - now.getTime()
    return {
      state: 'active',
      expiringSoon: msUntilExpiry <= EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000,
    }
  }

  return { state: 'expired', expiringSoon: false }
}

/**
 * Characters used in a payment reference: uppercase Latin letters and
 * digits with I, O, 0 and 1 removed, so a reference survives being read
 * aloud or transcribed into a bank memo. 32 symbols ⇒ 256 % 32 === 0,
 * so byte % 32 stays uniform (no modulo bias).
 */
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generates a unique, user-friendly payment reference for a submission,
 * e.g. `PAY-7K3M-9X2P` (two groups of four, displayed grouping only —
 * uniqueness comes from 8 bytes of OS entropy, 256^8 ≈ 7.2 × 10^19
 * combinations, so a collision is not a practical concern; the database
 * still enforces uniqueness on the submission row (issue 04)).
 */
export function generatePaymentReference(): string {
  const bytes = crypto.randomBytes(8)
  let value = ''
  for (const byte of bytes) {
    value += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]
  }
  return `PAY-${value.slice(0, 4)}-${value.slice(4)}`
}
