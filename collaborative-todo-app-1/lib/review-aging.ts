/**
 * @fileoverview Review-queue aging badge — pure presentation math
 * (subscription-billing issue 07)
 *
 * The Administrator's 24-hour promise (spec §Administration — "reviewed
 * within 24 hours") is triaged with an aging badge on every queue card:
 * "18h left" while the window runs, "OVERDUE" once 24 hours have passed
 * (spec story 36). One pure helper means the queue card, its tests, and
 * any future triage surface agree on the threshold and the wording.
 *
 * STRICTLY PURE: a submission time and the current time go in, display
 * data comes out — no I/O, no clock. Callers pass `now` explicitly, the
 * same convention as lib/subscription.ts, so a badge is reproducible in
 * tests and can be recomputed on every render of a long-open tab.
 *
 * Rounding: whole hours are rounded DOWN, so the badge never claims
 * more time than is actually left — 17h30m remaining reads "17h left",
 * which can only make the Administrator act earlier, never later. Under
 * an hour the unit switches to minutes for the same reason (with a
 * floor of one minute, because "0m left" reads like a breach while the
 * promise still has time to run). A timestamp in the future (clock skew
 * between app servers) is clamped to the full window rather than shown
 * as more time than the promise allows.
 */

/** The review window every badge counts down: 24 hours, inclusive. */
export const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** How one submission's age reads on its queue card. */
export interface ReviewAge {
  /** "18h left", "45m left", or the literal "OVERDUE". */
  label: string
  /** True exactly when the 24-hour window has passed — drives the alert styling. */
  overdue: boolean
}

/**
 * Computes the aging badge for a submission received at `submittedAt`,
 * as of `now`.
 *
 * The boundary is the promise itself: at exactly 24 hours elapsed the
 * badge is OVERDUE (the same "expiry bites AT the instant" convention
 * lib/subscription.ts uses for period ends — one millisecond earlier is
 * still "left").
 */
export function reviewAgeBadge(submittedAt: Date, now: Date): ReviewAge {
  const elapsed = now.getTime() - submittedAt.getTime()
  const remaining = Math.min(REVIEW_WINDOW_MS - elapsed, REVIEW_WINDOW_MS)

  if (remaining <= 0) {
    return { label: 'OVERDUE', overdue: true }
  }

  if (remaining < HOUR_MS) {
    return { label: `${Math.max(1, Math.floor(remaining / MINUTE_MS))}m left`, overdue: false }
  }

  return { label: `${Math.floor(remaining / HOUR_MS)}h left`, overdue: false }
}
