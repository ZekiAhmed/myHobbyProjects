# 01 — Platform Administrator role & gate

**What to build:** The app has a platform Administrator role distinct from the board Owner role. A one-time promotion gives the first Administrator; from then on, Administrators can promote and demote other users from within the app. Demotion guards (in one atomic transaction): an Administrator cannot demote themselves, and cannot demote the last remaining Administrator. A minimal protected admin area proves the gate: Administrators see it, regular users get a 403/denied response. Note the domain glossary: "admin" is explicitly avoided for board roles — this is the platform role that approves payments, and naming must not collide with Owner.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] User model carries a role enum (regular default, Administrator) with a clean migration
- [x] A `requireAdmin` session helper sits alongside the existing session helpers and is used by the admin area
- [x] One-time promotion path exists for the first Administrator (script/direct write)
- [x] In-app promote action works for Administrators and is blocked for regular users
- [x] Demote action refuses self-demotion and last-administrator demotion, atomically
- [x] Minimal admin page/route returns success for Administrators and 403 for everyone else
- [x] Schema and action tests cover the guards and the authorization boundary

## Comments

- **In-app controls ship with the gate.** The actions had no caller without a
  UI (the bootstrap script refuses once an Administrator exists), so
  `components/admin/RoleManager.tsx` lists users on /admin with
  Promote/Demote wired to the actions — no self-row button, refusals surface
  as error toasts, `router.refresh()` on success (prisma-driven server
  component, no fetch-cache tags to revalidate).
- **Demotion runs at Serializable isolation.** At the Postgres default
  (READ COMMITTED) two Administrators demoting each other both read
  `count = 2`, both pass the last-admin guard, and the instance is left with
  zero Administrators — the transaction is Serializable so one aborts
  (pinned by a test asserting the isolation option).
- **Signed-out visitors redirect, not 403** — spec's cookie-existence check
  design; only signed-in non-Administrators hit the forbidden() interrupt.
