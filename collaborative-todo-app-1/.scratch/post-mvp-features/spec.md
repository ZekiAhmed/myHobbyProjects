# Spec: Post-MVP Collaboration Features (Comments, Activity, Notifications, Sessions, Export)

Status: ready-for-agent

## Problem Statement

The MVP shared Kanban board coordinates a team's work, but teammates still lack the collaboration surface that makes a shared board trustworthy day-to-day:

- There is **nowhere to discuss a Todo** — blockers, context, and decisions get lost in chat threads that aren't attached to the work.
- After being away, a member has **no way to see what changed** on a board — who joined, what moved to Done, which comments were removed.
- Users cannot tell **who is signed in** on their account or cut off an old device, and have **no way to download their personal data** (GDPR right to access).
- Assignments and comments are **silent** — the assignee only discovers new work by manually polling the board.

These were deliberately deferred from MVP; the design is now settled and implementation must not re-litigate it.

## Solution

Ship the five designed post-MVP features as one coherent post-launch release:

1. **Todo comments** — a flat, plain-text, oldest-first Comment feed on each Todo; author edits/deletes own comments, the board Owner may delete any; deletion is permanent and recorded as an Activity event.
2. **Activity log** — a per-board, newest-first Activity feed of high-signal collaboration events (membership, todo lifecycle, comment create/delete, tags, board rename), visible to all members, with compliance-ready columns so the taxonomy can widen later without a migration.
3. **Notifications** — targeted in-app alerts only when something needs *you* (todo assigned to you; new comment on a todo you're assigned to or have commented on), surfaced as a global nav bell with an unread count; click opens the Todo and marks it read.
4. **Session enumeration UI** — a Security tab in Account settings listing the user's Active sessions with device/IP/timestamps; revoke any other session individually or all others in bulk; the current session is flagged and not revocable from itself.
5. **Data export** — a synchronous JSON download of all personal data about the user, with authentication secrets redacted.

Product specs live in PRD §4; architectural decisions in ADR-0001 (comments hard delete) and ADR-0002 (Activity is a user feed, not a full audit trail); vocabulary in `CONTEXT.md`; designed schema in TRD §12.

## User Stories

### Comments

1. As a board Member, I want to write a plain-text comment on a Todo, so that context and blockers stay attached to the work instead of scattered across chat.
2. As a board Owner, I want to comment on a Todo the same way a Member can, so that I am not forced into a separate channel to discuss work.
3. As a comment author, I want my comment rendered with preserved line breaks, so that pasted logs and multi-line notes stay readable.
4. As a comment author, I want to edit my own comment after posting, so that I can fix typos and correct outdated information.
5. As a board Owner, I want to see an "edited" timestamp on comments others have changed, so that I can tell the current text is not the original.
6. As a comment author, I want to delete my own comment permanently, so that I can remove something I posted by mistake.
7. As a board Owner, I want to delete any comment on any Todo of my board, so that I can moderate inappropriate or derailing content.
8. As a board Member who is neither author nor Owner, I want to be *unable* to edit or delete someone else's comment, so that the discussion record is not silently rewritten.
9. As a board Member viewing a busy Todo, I want the Comment feed to load the oldest 20 comments first with a "Load older" control, so that the panel opens instantly and I can page back through history deliberately.
10. As a board Member, I want the Comment feed to live inside the Todo side panel, so that discussion and task details are one surface, not two routes.
11. As a board Member, I want comment create/edit/delete to respect the same membership checks as todo mutations, so that a non-member cannot post even with a guessed Todo id.
12. As a board Member whose teammate's comment was removed, I want an Activity entry to show that a comment was deleted (without the body), so that the removal is not invisible.
13. As a user exercising GDPR erasure, I want my authored comments to disappear when my account is deleted, so that my written content does not outlive my account.
14. As a future maintainer, I want no tombstone/soft-delete flag on comments, so that feed queries and erasure stay simple cascades per ADR-0001.

### Activity log

15. As a board Member returning from leave, I want a newest-first Activity feed of my board, so that I can catch up on what changed without reading every Todo.
16. As a board Member, I want Activity entries for membership changes (invited, joined, removed, left), so that I know who has been on the board.
17. As a board Member, I want Activity entries for todo created, deleted, status changed, and assignee changed, so that the collaboration-relevant lifecycle is traceable.
18. As a board Member, I want Activity entries for comment created and comment deleted, so that moderation actions are visible even though comment bodies are hard-deleted.
19. As a board Member, I want Activity entries for tag created/deleted and board renamed, so that structural changes to the board are recorded.
20. As a board Member, I want title/description/priority/due-date edits and drag reorders **absent** from the feed, so that the signal stays high and the feed is not noise (ADR-0002).
21. As a board Member, I want the Activity feed at a dedicated board page (not buried in settings), so that catching up is a first-class navigation target.
22. As a board Member, I want Activity pagination to be newest-first, 20 per page, loading older pages on demand, so that the first paint is always the most recent events.
23. As a board Member, I want the same membership check as the board detail route guarding Activity reads, so that strangers cannot enumerate a board's history.
24. As a user who left the board, I want my past Activity entries to keep showing my name, so that history remains attributable while my account exists.
25. As a user who deleted my account, I want Activity entries I authored to remain but display "Former member", so that the board's history is preserved while my personal data is erased (`SetNull` actor).
26. As a board Owner deleting a board, I want the Activity log to cascade away with the board, so that no orphaned history lingers.
27. As a compliance reader later, I want every Activity entry to already carry resource type, resource id, actor, timestamp, and IP address, so that widening the taxonomy for SOC 2 never requires a migration (ADR-0002).
28. As an implementation agent, I want mutations that are in the taxonomy to emit Activity rows transactionally with the domain change, so that the feed cannot drift from reality.

### Notifications

29. As a Member, I want a Notification when a Todo is assigned to me, so that new obligations reach me without scanning every board.
30. As a todo Assignee, I want a Notification when someone comments on my assigned Todo, so that I can respond without re-polling.
31. As a prior commenter on a Todo, I want a Notification when a new comment lands on that Todo (excluding my own), so that a discussion pulls me back in without reply threads.
32. As a busy user, I want **no** notifications for status changes, membership events, tag edits, or board renames, so that my unread count stays meaningful (Activity log covers those).
33. As a user, I want **no** board-wide "todo created" broadcasts, so that a lively board does not bury the alerts that target me personally.
34. As a user, I want no email for in-app notifications, so that Resend remains strictly transactional (verify, reset, invite).
35. As an authed user on any app page, I want a global nav bell showing my unread count across all boards, so that I have one place to notice attention items.
36. As a user with no unread items, I want the bell badge hidden, so that the chrome stays quiet when nothing needs me.
37. As a user, I want the bell to open a dropdown of my latest 20 notifications (newest first), so that triage is one click from any page.
38. As a user clicking a Notification, I want navigation to that Todo's board with the side panel open on that Todo, so that the alert lands me exactly where I can act.
39. As a user, I want the Notification marked read automatically when I open it via click-through, so that I do not re-triage the same item.
40. As a user with many stale alerts, I want a single "mark all as read" action, so that I can reset my badge without clicking through each row.
41. As a user, I want unread notifications to refresh on the same 8-second poll cadence as todos while I am signed in, so that a teammate's assignment appears without manual refresh and I do not invent a second sync mechanism.
42. As a user whose board was deleted, I want notifications for that board to disappear, so that the bell never deep-links to a dead route.
43. As a user exercising account deletion, I want my notification rows erased with my account, so that unread state is not orphaned.
44. As a recipient, I want only targeted users to receive a given Notification, so that assignment/comment alerts are not broadcast to the whole board.

### Session enumeration UI

45. As a security-conscious user, I want a Security tab in Account settings listing my Active sessions, so that I can see every device signed into my account.
46. As a user, I want each session row to show a human device label (parsed user agent), IP address, created-at, and expires-at, so that I can recognize legitimate devices.
47. As a user, I want my current session flagged "This device", so that I never confuse the session I am using with an intruder's.
48. As a user, I want no revoke button on my current session (Sign out already exists), so that I cannot lock myself out from inside the session.
49. As a user, I want to revoke any other session individually, so that I can cut off one compromised device without ending my current work.
50. As a user, I want a "Sign out all other sessions" bulk action, so that a suspected compromise can be contained in one click.
51. As a user who revoked a session elsewhere, I want that device signed out on its next request, so that revocation is effective without waiting for expiry.
52. As a user, I want to list and revoke only my own sessions — never anyone else's — so that the feature cannot become an admin surveillance tool the product does not have.
53. As a returning user, I want the session list to reflect Better Auth's session records (including IP/user agent when captured), so that the UI does not invent a parallel session store.

### Data export

54. As an EU user, I want an "Export my data" button in Account settings, so that I can exercise GDPR right to access without emailing support.
55. As a user, I want the export to download synchronously as a single JSON attachment, so that I get my data immediately with no async job or email delay.
56. As a user, I want the export to include my profile (name, email, verification state, timestamps), so that the core identity record is captured.
57. As a user, I want account-provider metadata and session metadata (IP, device, dates) included, so that my auth footprint is visible to me.
58. As a user, I want boards I own and all my memberships included, so that my collaboration graph is portable.
59. As a user, I want todos assigned to me plus all todos on boards I own included, so that my work items are portable.
60. As a user, I want every comment I authored (on any board) included, so that my written contributions are portable.
61. As a user, I want notifications addressed to me, Activity entries where I am the actor, and invitations sent to my email included, so that my behavioral footprint is complete.
62. As a security-conscious user, I want password hashes, session tokens, and invite tokens **excluded**, so that the export never becomes a credential leak.
63. As a user, I understand the export cannot list "todos I created" on boards I do not own because the schema has no creator field — I accept that gap for this release.

### Cross-cutting

64. As a board Member who is not the Owner, I want comments, activity, notifications, and reads gated by membership — not owner checks — so that collaboration is not throttled by moderation boundaries.
66. As an Owner, I want Owner-only powers limited to comment deletion (and existing settings powers), so that the Owner vs Member matrix stays explicit.
66. As a developer, I want all five features expressed through the existing two-cache invalidation rule (server revalidate + client invalidate after mutations), so that feeds and badges do not go stale.
67. As a developer, I want comment/activity/notification list reads to use infinite pagination from day one, so that we never ship a "fetch the full list" pattern that must be undone later.
68. As a product owner, I want this release to land only after MVP launch (first post-launch migration carries the three new models), so that MVP scope is not reopened.

## Implementation Decisions

- **Scope:** exactly the five PRD §4 "Should Have (Post-MVP)" features — Comments, Activity log, Session UI, Data export, Notifications. No other post-MVP items.
- **Vocabulary:** all artifacts and code names must use `CONTEXT.md` terms (Comment, Comment feed, Activity log/entry/feed, Notification, Unread count, Active session, Data export). Do not use "audit trail", "thread", "card", etc.
- **ADRs binding this work:**
  - ADR-0001: comments are **hard-deleted**; author edit/delete + Owner delete-any; removal recorded as an Activity event, never a tombstone.
  - ADR-0002: Activity is a **high-signal user feed** with compliance-ready columns; taxonomy logs only collaboration events; `action` and `resourceType` are free strings (not enums) so widening never migrates; field-level edits are an accepted unrecoverable gap.
- **Designed schema (TRD §12) is authoritative:** three new models — Comment (todo + author, cascade), Activity (board cascade, actor optional `SetNull`, `ipAddress` nullable), Notification (recipient cascade, optional actor `SetNull`, board cascade, todo cascade, `readAt` nullable, enum type `ASSIGNED | COMMENTED`) — plus relation back-links on User, Board, and Todo. Ship in the first post-launch migration alongside the existing MVP schema.
- **Comment design:** Todo-scoped only (no board-level comments); flat (no reply parenting); plain text with newline preservation (no Markdown pipeline); oldest → newest; 20 per page; explicit "Load older" control; rendered in the Todo side panel via infinite query against a read endpoint.
- **Activity design:** per-board only; dedicated board sub-route named for the Activity feed; newest → oldest; 20 per page; read access requires board membership (same check as board detail); entries cascade with the board; taxonomy fixed to: board renamed, member invited/joined/removed/left, todo created/deleted/status changed/assignee changed, comment created/deleted, tag created/deleted; actor resolution after account deletion renders "Former member"; members merely removed from the board keep their names.
- **Activity emission:** mutations already inside the taxonomy emit an Activity row in the same server-side operation as the domain change (transactional with it), capturing actor and best-effort IP; mutations outside the taxonomy must not emit.
- **Notification design:** creation only for (a) todo assigned to a user, (b) new comment on a todo where the recipient is assignee or a prior commenter, excluding the actor and excluding self-assignments/self-comments as appropriate; no other types in the enum; in-app only — no email channel, no due-date reminders, no broadcasts.
- **Notification surface:** global app-shell bell with unread count (null `readAt`); dropdown lists latest 20 newest-first; click-through navigates to the todo (board route + side panel focus) and sets `readAt`; single mark-all-read server action; list polled on the same 8-second cadence as todos while authenticated; mutations continue to follow the two-cache invalidation rule.
- **Session UI:** Security tab within Account settings; data sourced from Better Auth's session listing/revoke APIs (no parallel session store); row = device label + IP + created/expires; current session flagged, not individually revocable; revoke any other session; bulk "sign out all other sessions"; strictly self-service — no admin/cross-user view exists in the product.
- **Data export:** authenticated GET returning JSON as a file attachment, triggered by an Account settings button; synchronous fan-out of the user's own data (profile, account metadata, session metadata, owned boards + memberships, assigned todos + todos on owned boards, authored comments, addressed notifications, actor-scoped Activity, invitations to their email); **redact** password hashes, session tokens, invite tokens; accepted gap: no `createdBy` on Todo, so "todos I created elsewhere" are out of reach until a future schema addition.
- **Authorization model unchanged:** membership gates collaborative reads/writes; Owner-only power in this release is limited to deleting others' comments (plus existing settings powers); Session and Export are strictly self-scoped; Export requires only an authenticated session.
- **Pagination rule (TRD §9):** Comment feed, Activity feed, and Notification dropdown all use infinite/progressive loading from day one — never fetch-full-list.
- **No new infrastructure:** no WebSocket, no job queue, no email templates, no scheduling/cron for due dates, no async export worker.

## Testing Decisions

- **Good tests:** exercise external behavior only — return values/payloads, rows persisted (Activity/Notification/Comment records *are* the product behavior), and authorization outcomes. Do not assert internal call graphs, private helpers, or rendering details.
- **Single seam — server entrypoints:** every Server Action and Route Handler is tested as an exported function. Mock `db`, session helpers, Better Auth, and Resend at the module boundary. Prefer this one seam over introducing component/e2e layers for this release.
- **Coverage map at that seam:**
  - Comment actions: create/edit/delete authorization matrix (author, Owner, unrelated member, non-member), hard-delete behavior (row gone, Activity row written on delete), edit success/failure.
  - Comment feed read: membership enforcement, oldest-first order, 20-item page boundary, "load older" continuation contract.
  - Mutations in the Activity taxonomy: assert Activity row fields (action, resourceType, resourceId, actor, board) written atomically with the domain change; mutations outside taxonomy assert **no** Activity row.
  - Activity feed read: membership enforcement, newest-first order, page boundary; actor-null rendering input ("Former member" when actor missing).
  - Notification-creating paths: assignment and qualifying comment write exactly the targeted recipients' rows; excluded events write none.
  - Notification actions: mark-one and mark-all set `readAt` only for the acting user; unread-count read returns null-`readAt` count for that user only.
  - Session actions: list/revoke scoped to the session owner; current-session revoke rejected; bulk revoke leaves current session intact.
  - Export route: includes each documented section for a seeded user; asserts absence of password hash/session token/invite token; asserts auth required.
- **Prior art:** follow `lib/__tests__/session.test.ts` and `lib/__tests__/invite-tokens.test.ts` — Vitest, `vi.mock` of module dependencies, success and failure branches, no real database. Node test environment as configured.
- **Not tested at this seam (explicitly):** React component markup, dnd interactions, poll timers, CSS. If later product-wide e2e is introduced, a thin smoke (bell visible, export downloads) may be added — not required for this spec.

## Out of Scope

- MVP work already shipped or still in Milestone 5 polish — this spec does not reopen MVP scope.
- Reply threads / nested comments; board-level comments; Markdown or rich-text comment bodies; comment soft delete/tombstones.
- Field-level Activity (title/priority/due-date edits, reorders); cross-board or global activity; Activity retention policies beyond board cascade.
- Email notifications, push, due-date reminders/scheduling, notification preferences/settings, per-notification "unsubscribe", board-wide broadcasts.
- Admin or cross-user session viewing; OAuth/social login changes; session lifetime policy changes.
- Async/background export jobs, CSV formats, partial/paginated exports; export of other users' personal data; `createdBy` schema addition for todos.
- WebSocket real-time, virtualized lists, i18n, third-party integrations, file attachments, custom Kanban columns, ownership transfer, tag templates (remaining Could-Have/Out-of-Scope items).
- SOC 2 formal audit readiness beyond the compliance-ready Activity columns already designed.
- Documentation site, marketing pages, or PRD/TRD edits beyond what this spec already reflects (PRD §4, TRD §12, ADRs, `CONTEXT.md` are the design record).

## Further Notes

- **Design provenance:** this spec synthesizes a completed grill-with-docs session. Do not re-ask settled questions (flat comments, hard delete, taxonomy, targeted-only notifications, self-only sessions, sync JSON export). If implementation hits a genuine contradiction between PRD §4, TRD §12, and the ADRs, treat ADRs as binding, then PRD, then TRD wording.
- **Ordering hint (not enforced):** Comment and Activity models interact (comment delete emits Activity); Notification depends on assignment + comment write paths existing; Export should land after Comments/Activity/Notifications so the payload sections exist; Session UI is independent and can ship any time.
- **Migration note:** all three new models and back-relations go in the first post-launch migration together — avoid three tiny migrations.
- **Tracker:** label `ready-for-agent` applied — fully specified, no triage needed. Split into per-ticket files under `.scratch/post-mvp-features/issues/` when picked up for execution.
