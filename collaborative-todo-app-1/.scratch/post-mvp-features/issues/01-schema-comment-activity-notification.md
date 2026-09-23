# 01 — Post-launch schema: Comment, Activity, Notification models

**What to build:** The first post-launch migration lands all three designed Collaboration models — Comment, Activity, Notification — plus their back-relations on User, Board, and Todo, exactly as specified in the design record (TRD §12). The application still behaves identically (no new behavior), but the Prisma client exposes the new models so every later ticket can build on one settled schema. One migration only; no feature code.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Comment model exists: todo relation (cascade), author relation (cascade), plain-text body, timestamps; no soft-delete/tombstone column (ADR-0001)
- [ ] Activity model exists: board cascade, nullable actor with `SetNull`, free-string action and resource type (not enums — ADR-0002), nullable IP address, board+time index
- [ ] Notification model exists: recipient cascade, nullable actor `SetNull`, board cascade, todo cascade, nullable `readAt`, type enum limited to assignment and comment events, unread and recency indexes
- [ ] Back-relations added on User (authored comments, acted Activity, received/perpetrated Notifications), Board (Activity, Notifications), Todo (comments, Notifications)
- [ ] Single migration applies cleanly on a fresh database and on an existing MVP database; generated client typechecks
- [ ] Existing test suite still passes with zero behavior changes
