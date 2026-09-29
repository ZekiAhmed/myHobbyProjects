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
import type { PaymentStatus } from '@/lib/generated/prisma/browser'

/** Days before expiry at which the T-7 warning banner appears. */
export const EXPIRY_WARNING_DAYS = 7

/**
 * How long a payment attempt stays live before it expires (spec
 * §Payment lifecycle): 48 hours without a receipt, carried in the
 * submission's `expiresAt`. Expiry is lazy — the next subscribe attempt
 * flips the stale row to EXPIRED inside its own transaction.
 */
export const PAYMENT_INSTRUCTION_TTL_MS = 48 * 60 * 60 * 1000

/**
 * The statuses that count as "a payment attempt in progress": at most
 * ONE of these per user, ever (spec §Payment lifecycle). Shared by the
 * subscribe action's guard and the upgrade screen's read so the two
 * can never drift apart.
 */
export const NON_TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ['AWAITING_UPLOAD', 'PENDING']

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
 * The entitlement check as a yes/no: is this subscriber Pro right now?
 *
 * Answers from the stored period end alone (subscription-billing issue
 * 09), so the paywall, the expiry lock and the UI can never disagree
 * about what "Pro" means. Use it wherever a boolean answer is enough;
 * `deriveBoardWriteLock` also needs the REASON it is not Pro, so it goes
 * through `deriveSubscription` for both the state and the boundary.
 *
 * Boundary: the period has ended AT `periodEnd`, so Pro is lost at the
 * instant itself (no grace period) — the same convention as
 * deriveSubscription.
 */
export function isProSubscriber(periodEnd: Date | null, now: Date): boolean {
  return deriveSubscription(periodEnd, now).state === 'active'
}

/**
 * Why a Board is locked for writing, mirroring the derived
 * SubscriptionState that caused it:
 * - 'expired' — the Owner's paid period ended (lapsed subscriber)
 * - 'none'    — the Owner has never had a paid period
 *
 * `null` reason always accompanies `locked: false`.
 */
export type BoardWriteLockReason = Extract<SubscriptionState, 'expired' | 'none'>

export interface BoardWriteLock {
  locked: boolean
  reason: BoardWriteLockReason | null
}

/**
 * The expiry rule as pure math (spec §Domain & entitlement): a Board
 * WITH Members requires its Owner to be Pro; a Board WITHOUT Members is
 * ordinary free-tier work and is never locked.
 *
 * Nothing is stored, scheduled or mutated — the lock is re-derived from
 * the Owner's period end on every read and write, so it turns on and off
 * by itself the moment the clock crosses `periodEnd`.
 */
export function deriveBoardWriteLock(input: {
  hasMembers: boolean
  ownerPeriodEnd: Date | null
  now: Date
}): BoardWriteLock {
  if (!input.hasMembers) {
    return { locked: false, reason: null }
  }

  const state = deriveSubscription(input.ownerPeriodEnd, input.now).state

  return state === 'active'
    ? { locked: false, reason: null }
    : { locked: true, reason: state }
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
