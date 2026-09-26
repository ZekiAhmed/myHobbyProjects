# 07 — Admin review queue & approve/reject

**What to build:** The Administrator opens the review queue: pending submissions oldest-first, each with an aging badge ("18h left", OVERDUE past 24 hours), the expected amount (snapshot), submitter name/email, submission time, and payment reference. The receipt image/PDF is viewable behind the admin gate. Approve sets the subscriber's period end — starting the clock now, or stacking onto the current period end if already active — under a terminal-state guard so double-clicks and stale tabs cannot double-apply. Reject requires a non-empty reason and is guarded the same way. A transfer without the memo reference is still approvable via the amount + sender name + date fallback shown on the review card.

**Blocked by:** 01 — Platform Administrator role & gate, 03 — Subscription date & entitlement math, 05 — Receipt upload → review queue.

**Status:** ready-for-agent

- [ ] Admin-only queue route returns pending submissions oldest-first with aging/OVERDUE badges
- [ ] Receipt viewer is admin-gated; regular users get 403
- [ ] Approve action transitions PENDING → APPROVED and sets period end via the pure helpers (now-or-stacked), atomically with guards
- [ ] Reject action transitions PENDING → REJECTED with a mandatory reason; empty reason is rejected
- [ ] Review card shows snapshot amount, submitter identity, submission time, reference, supporting fallback matching
- [ ] Non-administrators are rejected from every queue/viewer/action path
- [ ] Tests cover ordering, badges, both transitions, terminal-state guards, required reason, and authorization
