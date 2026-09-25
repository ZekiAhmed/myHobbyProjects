# 08 — Data export (GDPR right to access)

**What to build:** In Account settings, **"Export my data"** downloads a single synchronous JSON attachment of all personal data about that user: profile; account-provider metadata; session metadata; owned boards and memberships; todos assigned to them plus all todos on boards they own; Comments they authored; Notifications addressed to them; Activity entries where they are the actor; Invitations addressed to their email. **Password hashes, session tokens, and invite tokens are never included.** Auth required; no async job, no email delivery. Accepted gap stands: without a Todo creator field, "todos I created on boards I don't own" are not in the payload.

**Blocked by:** 03 — Comment lifecycle (edit / hard delete); 04 — Activity feed + taxonomy emissions; 06 — Comment-triggered Notifications

**Status:** done

- [x] Account settings exposes an "Export my data" control for any authenticated user
- [x] Request returns a JSON file attachment synchronously (Content-Disposition attachment) — completes without background job or emailed link
- [x] Payload includes: profile (name, email, verification, timestamps); account metadata; session metadata (IP/device/dates); owned boards + memberships; assigned todos + todos on owned boards; authored Comments; addressed Notifications (incl. read state); actor-scoped Activity entries; Invitations to their email
- [x] Payload omits password hashes, session tokens, and invite tokens anywhere in the structure (asserted, not just unrendered)
- [x] Unauthenticated request is rejected
- [x] Another user's private rows (their Comments, their Notifications, their sessions) never appear in this user's export; cross-board visibility limited to data the exporter already owns/is assigned
- [x] Server-entrypoint tests: each documented section present for a seeded user; redaction assertions for the three secret classes; auth rejection; no cross-user leakage — external behavior only, per prior art

## Comments

- **Redaction is a projection, not a query shape.** Every section is built by
  picking named fields off the row (`projectTodo`, plus the inline maps), so the
  test can hand the route *raw* rows containing `password` / `token` and assert the
  downloaded body never carries them — a `select`-only redaction would only prove
  what the mocked db returned. OAuth `accessToken`/`refreshToken`/`idToken` are
  dropped with the three mandated classes: credentials are not personal data.
- **401 instead of a redirect:** `getOptionalSession()` + 401, since this route
  answers a download rather than a page (`getRequiredSession`'s `/sign-in`
  redirect is the page contract). Export needs no board check — every section is
  self-scoped.
- **Invitations match their email case-insensitively** (`mode: 'insensitive'`):
  invite rows store the address exactly as the inviting Owner typed it, so an
  exact match would silently drop an invite addressed to the same mailbox.
- **Todos section:** assigned todos and todos on owned boards are fetched by one
  helper (`fetchTodos`) that returns the payload's `todos` shape directly — a todo
  the owner also holds appears in both lists, which is the literal PRD wording.
- **Settings control:** a plain link to `/api/me/export` rendered with the
  `outline` button variant in the Account tab; the browser downloads it off the
  `Content-Disposition` header, so no client-side blob plumbing.

**Shipped:** `app/api/me/export/route.ts` (GET, projection + attachment headers),
`components/settings/AccountSettingsClient.tsx` ("Your data" card with the
"Export my data" control) — 12 server-entrypoint tests in
`app/api/me/export/__tests__/route.test.ts` covering the section checklist,
redaction of the three secret classes, 401 rejection, cross-user leakage /
cross-board limits, and the attachment headers.
Verified with `npx tsc --noEmit`, `npx eslint`, and the full Vitest suite (177 passed).
