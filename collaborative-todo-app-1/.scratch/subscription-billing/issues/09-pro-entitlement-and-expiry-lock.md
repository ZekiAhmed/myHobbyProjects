# 09 — Pro entitlement & expiry lock

**What to build:** The app can answer "is this user Pro?" by deriving state from their period end (pure helpers from ticket 03), and enforces it at expiry: Boards that have Members become read-only for everyone — visible, never deleted or hidden — while the owner's Board-less-Members Boards stay fully editable under the free tier. A lapsed subscriber sees a clear renew prompt on read-only Boards explaining how to restore editing. No grace period; the lock is immediate and derived lazily at read time (no cron).

**Blocked by:** 03 — Subscription date & entitlement math, 07 — Admin review queue & approve/reject.

**Status:** ready-for-agent

- [ ] A single entitlement check answers Pro status from the subscriber's period end
- [ ] At expiry, Boards with Members deny writes for owners and Members alike, while remaining fully viewable
- [ ] Boards without Members remain fully writable after expiry
- [ ] Lapsed state shows a self-service renew prompt on read-only Boards
- [ ] No data is deleted or hidden at any point; state is derived, not scheduled
- [ ] Tests cover active vs. expired access, the with/without-Members split, and boundary instants
