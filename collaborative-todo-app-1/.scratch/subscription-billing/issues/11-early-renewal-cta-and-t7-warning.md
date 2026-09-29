# 11 — Early renewal CTA & T-7 warning

**What to build:** An active subscriber never falls into a locked gap. The upgrade screen shows "Extend by 1 month" instead of a plain Subscribe while Pro is active, and approving that renewal stacks onto the current period end (arithmetic proven in ticket 03, applied in ticket 07). Seven days before expiry, a warning banner appears to the subscriber only — never to Members — with the calendar renewal date ("renews 25 March"). The renewal date is always shown as a clamped calendar date, never a drifting day counter.

**Blocked by:** 04 — Subscribe: payment instruction card, 09 — Pro entitlement & expiry lock.

**Status:** done

- [x] Active subscribers see the "Extend by 1 month" CTA; lapsed/none see the normal Subscribe CTA
- [x] An approved renewal stacks: period end = max(now, current end) + 1 calendar month (covered end-to-end)
- [x] T-7 warning banner renders for the subscriber within 7 days of expiry and never for Members
- [x] All renewal/expiry dates render as clamped calendar dates
- [x] Tests cover CTA states, stacked approval result, banner visibility conditions, and date rendering

## Comments

Shipped in three surfaces, all reading the same pure helpers:

- **CTA** — `app/(app)/upgrade/page.tsx` derives one `renewal` string (non-null ⇔ `isProSubscriber(periodEnd, now)`), so the label and the date can never disagree: active → "Extend your subscription / renews 15 November" with `SubscribeButton label="Extend by 1 month"`; lapsed/none → the unchanged Subscribe section. The attempt cards still win while an attempt is live (one attempt at a time), and `SubscribeButton`'s `label` prop is cosmetic — same action, same flow.
- **T-7 banner** — `components/subscription/ExpiryWarningBanner.tsx`, a pure server component taking `{ periodEnd }` and deriving visibility (`deriveSubscription`'s `expiringSoon`, inclusive at exactly 7 days), `role="status"`, `data-testid="expiry-warning-banner"`, carrying the calendar renewal date plus the `/upgrade` link. Mounted in `app/(app)/layout.tsx` under `PendingReviewBanner`, fed the *acting user's own* period end — a team Member has none, so the countdown is structurally subscriber-only, and no expiry ever leaks across users. No cron, no stored warning (spec §Domain & entitlement).
- **Dates** — `formatRenewalDate` in `lib/subscription.ts` ("25 March", `en-GB` + UTC) now renders the renewal date on the upgrade screen, the banner, and the admin approval toast (`ReviewQueue`'s "paid through …", replacing a clock reading). `addCalendarMonth` was moved onto the UTC calendar in the same change (see below), so the date computed is the date rendered. The approval email keeps its own UTC calendar format (ticket 08) — same zone, same day.

### Code review follow-ups (both axes run before commit)

Fixed:

- **Arithmetic ran on the server's local calendar while every surface renders UTC** (spec axis, verified): `addCalendarMonth` used local getters, so on a server west of UTC `computePeriodEnd` + `formatRenewalDate` could announce a renewal date a day off the instant they were computed from (the new stack-and-render test failed outright under `TZ=America/New_York`). The clamped-month rule is untouched — only the zone is now UTC, matching rendering and the approval email, so billing math is timezone-independent. Ticket 03's fixtures were rebuilt as `Date.UTC(...)` (worked examples unchanged) so the suite holds in any zone: verified green under `UTC`, `America/New_York`, `Pacific/Kiritimati`, and the machine's `UTC+3`.
- **The renewal path dropped the review promise** (spec §Money: "the upgrade UI promises review within 24 hours") — the Extend section had lost the sentence the Subscribe section still carries, though extending starts the same receipt flow. Restored, with a test.
- **`deriveSubscription(...) === 'active'`** replaced by `isProSubscriber` (the helper's own doc: use it wherever a boolean is enough); the read variable renamed `me` → `subscriber`, matching the layout.
- **Stacking now proven across the display seam**: the action's stacking test additionally asserts `formatRenewalDate` of the stored end ("15 December"), so ticket 07's arithmetic and ticket 11's rendering are checked together, alongside the existing approval → screen (upgrade) and approval → banner paths.

Accepted after review (noted, not changed):

- **The banner still offers "Extend by 1 month" while a renewal is already under review.** The banner would need a second query on every app page to know that; the link's destination (`/upgrade`) handles the pending state correctly and shows the waiting card, so the dead end is self-correcting. Cheaper than a per-render attempt read for every user.
- **The admin toast renders the year-less calendar date** ("paid through 28 November"), consistent with every other renewal surface (spec example has no year); unambiguous in context and in the row above it.
- **Duplicated prisma period-end read** (layout + upgrade) left in place — ticket 07's precedent: extract `getOwnPeriodEnd(userId)` when the third call site appears.
- The four-way CTA ternary on `/upgrade` grows by one branch per issue; extraction of the pay-CTA block deferred until it stabilises.
- The banner's extra line ("Renew early to stack another month…") goes beyond story 28's warning + date — sales copy in the spec's own voice, kept.
- "Calendar date, never a counter" (`not.toMatch(/\b\d+\s+days?\b/i)`) is asserted in three test files; a shared assertion helper deferred (cosmetic duplication).
