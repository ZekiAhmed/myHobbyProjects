# 07 — Account Security tab (Active sessions)

**What to build:** In Account settings, a **Security** tab lists the user's **Active sessions** — human device label (parsed user agent), IP address, created-at, expires-at — sourced from Better Auth's session store (no parallel store). The current session is flagged **"This device"** and has no revoke control (nav Sign out already exists). Any other session can be revoked individually, and **"Sign out all other sessions"** revokes the rest in one action while leaving the current session intact. Strictly self-service: users only ever list/revoke their own sessions; no admin or cross-user view.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Security tab exists within Account settings alongside existing account actions
- [ ] List shows each Active session with device label, IP, created-at, expires-at — from Better Auth session data, not a new store
- [ ] Current session visibly flagged "This device" and exposes no per-row revoke control
- [ ] Revoking another session succeeds; that session is no longer listed and its device is signed out on next request
- [ ] "Sign out all other sessions" revokes every non-current session in one server action; current session remains active
- [ ] Entire feature scoped to the acting user's sessions — a user cannot list or revoke anyone else's; no admin surface
- [ ] Server-entrypoint tests: list-scoped-to-self, individual revoke of other, current-session revoke rejected, bulk revoke preserves current, cross-user access rejected — external behavior only, per prior art
