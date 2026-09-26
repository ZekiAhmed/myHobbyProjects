# 01 — Platform Administrator role & gate

**What to build:** The app has a platform Administrator role distinct from the board Owner role. A one-time promotion gives the first Administrator; from then on, Administrators can promote and demote other users from within the app. Demotion guards (in one atomic transaction): an Administrator cannot demote themselves, and cannot demote the last remaining Administrator. A minimal protected admin area proves the gate: Administrators see it, regular users get a 403/denied response. Note the domain glossary: "admin" is explicitly avoided for board roles — this is the platform role that approves payments, and naming must not collide with Owner.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] User model carries a role enum (regular default, Administrator) with a clean migration
- [ ] A `requireAdmin` session helper sits alongside the existing session helpers and is used by the admin area
- [ ] One-time promotion path exists for the first Administrator (script/direct write)
- [ ] In-app promote action works for Administrators and is blocked for regular users
- [ ] Demote action refuses self-demotion and last-administrator demotion, atomically
- [ ] Minimal admin page/route returns success for Administrators and 403 for everyone else
- [ ] Schema and action tests cover the guards and the authorization boundary
