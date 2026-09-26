# 11 — Early renewal CTA & T-7 warning

**What to build:** An active subscriber never falls into a locked gap. The upgrade screen shows "Extend by 1 month" instead of a plain Subscribe while Pro is active, and approving that renewal stacks onto the current period end (arithmetic proven in ticket 03, applied in ticket 07). Seven days before expiry, a warning banner appears to the subscriber only — never to Members — with the calendar renewal date ("renews 25 March"). The renewal date is always shown as a clamped calendar date, never a drifting day counter.

**Blocked by:** 04 — Subscribe: payment instruction card, 09 — Pro entitlement & expiry lock.

**Status:** ready-for-agent

- [ ] Active subscribers see the "Extend by 1 month" CTA; lapsed/none see the normal Subscribe CTA
- [ ] An approved renewal stacks: period end = max(now, current end) + 1 calendar month (covered end-to-end)
- [ ] T-7 warning banner renders for the subscriber within 7 days of expiry and never for Members
- [ ] All renewal/expiry dates render as clamped calendar dates
- [ ] Tests cover CTA states, stacked approval result, banner visibility conditions, and date rendering
