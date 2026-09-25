# 07 — Account Security tab (Active sessions)

**What to build:** In Account settings, a **Security** tab lists the user's **Active sessions** — human device label (parsed user agent), IP address, created-at, expires-at — sourced from Better Auth's session store (no parallel store). The current session is flagged **"This device"** and has no revoke control (nav Sign out already exists). Any other session can be revoked individually, and **"Sign out all other sessions"** revokes the rest in one action while leaving the current session intact. Strictly self-service: users only ever list/revoke their own sessions; no admin or cross-user view.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Security tab exists within Account settings alongside existing account actions
- [x] List shows each Active session with device label, IP, created-at, expires-at — from Better Auth session data, not a new store
- [x] Current session visibly flagged "This device" and exposes no per-row revoke control
- [x] Revoking another session succeeds; that session is no longer listed and its device is signed out on next request
- [x] "Sign out all other sessions" revokes every non-current session in one server action; current session remains active
- [x] Entire feature scoped to the acting user's sessions — a user cannot list or revoke anyone else's; no admin surface
- [x] Server-entrypoint tests: list-scoped-to-self, individual revoke of other, current-session revoke rejected, bulk revoke preserves current, cross-user access rejected — external behavior only, per prior art

## Comments

- **Account settings shell:** no Account settings route existed at the base commit, so
  the ticket ships `/settings` with Account + Security tabs. The Account tab carries the
  existing account actions (identity display + Sign out) for the Security tab to sit
  alongside; nav gets a settings gear and `proxy.ts` cookie-guards `/settings`.
- **Data source decision:** reads Better Auth's own Session store (the prisma `Session`
  model Better Auth writes through its adapter) directly instead of calling
  `auth.api.listSessions` — that endpoint runs Better Auth's `freshSessionMiddleware`,
  which rejects any session older than `freshAge` (default 24h; verified in
  better-auth 1.7.4 source), and this app's sliding session never rewrites `createdAt`.
  The tab would 403 for exactly the long-lived sessions it exists to show. Same store,
  no parallel store (spec req 53); revokes are userId-scoped deletes with rejection on
  miss, so cross-user revokes fail without leaking existence; session tokens never reach
  the client (revocation is by row id).

**Shipped:** `actions/sessions.ts` (list / revoke / bulk + two-cache `revalidateTag`),
`lib/user-agent.ts` (device label parser), `lib/types.ts` `ActiveSession`,
`sessionKeys`, `app/(app)/settings/page.tsx`,
`components/settings/{AccountSettingsClient,ActiveSessions}.tsx`, AppNav settings link,
`proxy.ts` guard — 5 server-entrypoint tests in `actions/__tests__/sessions.test.ts`.
Verified with `npx tsc --noEmit`, `npx eslint`, and the full Vitest suite (165 passed).
`next build` still fails on a **pre-existing** `/reset-password` missing-Suspense error,
reproduced on the base commit `457b02e` without these changes.
