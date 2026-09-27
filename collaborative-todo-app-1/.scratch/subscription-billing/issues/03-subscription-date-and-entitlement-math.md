# 03 — Subscription date & entitlement math (pure)

**What to build:** The arithmetic heart of billing, as pure functions with no I/O, so every later ticket composes proven pieces: (1) calendar-month period end with month-end clamping — Jan 31 approval ends Feb 28/29, never March 3; (2) stacked renewal — new end = max(now, current end) + 1 calendar month; (3) derived subscription state from a period end and the current time — none / active / expired, plus a "within 7 days of expiry" warning flag; (4) unique payment reference generation for a submission.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Calendar-month helper clamps correctly for Jan 31, Feb 29/28, and month-end cases, with tests
- [x] Stacked-renewal helper returns the correct end date when active and when lapsed
- [x] Derived state returns none/active/expired and the T-7 warning flag from a period end, with tests at boundaries (exact expiry instant included)
- [x] Reference generator produces unique, user-friendly references with a test
- [x] No function performs database or network I/O

## Comments

- **Ships as `lib/subscription.ts` + `lib/__tests__/subscription.test.ts`** (21 tests):
  `addCalendarMonth` (clamped month add), `computePeriodEnd` (stacked
  renewal), `deriveSubscription` (state + T-7 flag), and
  `generatePaymentReference` — all pure; `now` is always a parameter,
  never `Date.now()`. The only effectful call is `crypto.randomBytes`
  for references (no DB/network, same as `lib/utils/invite-tokens.ts`).
- **Expiry bites AT `periodEnd`:** the state is `expired` at the exact
  instant (spec: "at expiry, Boards with Members become read-only", no
  grace period). Note the deliberate divergence from the Invitation
  helper `isTokenExpired` (`now > expiresAt`, valid *at* the instant) —
  downstream code must not mix the two conventions.
- **T-7 flag is inclusive:** warning on at exactly 7 days remaining,
  off one millisecond earlier; only ever set while `active`.
- **References look like `PAY-7K3M-9X2P`** — 8 bytes of OS entropy over
  a 32-symbol alphabet excluding I/O/0/1 so the memo survives
  transcription; uniqueness is still enforced at the database level by
  issue 04.
- **Glossary gap flagged:** `Subscription`, `Pro`, `period end`, and
  `payment reference` are used here but undefined in `CONTEXT.md` —
  already noted in the spec for `/domain-modeling`.
