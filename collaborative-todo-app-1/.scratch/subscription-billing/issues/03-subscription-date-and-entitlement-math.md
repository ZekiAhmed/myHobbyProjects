# 03 — Subscription date & entitlement math (pure)

**What to build:** The arithmetic heart of billing, as pure functions with no I/O, so every later ticket composes proven pieces: (1) calendar-month period end with month-end clamping — Jan 31 approval ends Feb 28/29, never March 3; (2) stacked renewal — new end = max(now, current end) + 1 calendar month; (3) derived subscription state from a period end and the current time — none / active / expired, plus a "within 7 days of expiry" warning flag; (4) unique payment reference generation for a submission.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Calendar-month helper clamps correctly for Jan 31, Feb 29/28, and month-end cases, with tests
- [ ] Stacked-renewal helper returns the correct end date when active and when lapsed
- [ ] Derived state returns none/active/expired and the T-7 warning flag from a period end, with tests at boundaries (exact expiry instant included)
- [ ] Reference generator produces unique, user-friendly references with a test
- [ ] No function performs database or network I/O
