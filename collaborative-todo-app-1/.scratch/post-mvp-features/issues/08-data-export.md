# 08 — Data export (GDPR right to access)

**What to build:** In Account settings, **"Export my data"** downloads a single synchronous JSON attachment of all personal data about that user: profile; account-provider metadata; session metadata; owned boards and memberships; todos assigned to them plus all todos on boards they own; Comments they authored; Notifications addressed to them; Activity entries where they are the actor; Invitations addressed to their email. **Password hashes, session tokens, and invite tokens are never included.** Auth required; no async job, no email delivery. Accepted gap stands: without a Todo creator field, "todos I created on boards I don't own" are not in the payload.

**Blocked by:** 03 — Comment lifecycle (edit / hard delete); 04 — Activity feed + taxonomy emissions; 06 — Comment-triggered Notifications

**Status:** ready-for-agent

- [ ] Account settings exposes an "Export my data" control for any authenticated user
- [ ] Request returns a JSON file attachment synchronously (Content-Disposition attachment) — completes without background job or emailed link
- [ ] Payload includes: profile (name, email, verification, timestamps); account metadata; session metadata (IP/device/dates); owned boards + memberships; assigned todos + todos on owned boards; authored Comments; addressed Notifications (incl. read state); actor-scoped Activity entries; Invitations to their email
- [ ] Payload omits password hashes, session tokens, and invite tokens anywhere in the structure (asserted, not just unrendered)
- [ ] Unauthenticated request is rejected
- [ ] Another user's private rows (their Comments, their Notifications, their sessions) never appear in this user's export; cross-board visibility limited to data the exporter already owns/is assigned
- [ ] Server-entrypoint tests: each documented section present for a seeded user; redaction assertions for the three secret classes; auth rejection; no cross-user leakage — external behavior only, per prior art
