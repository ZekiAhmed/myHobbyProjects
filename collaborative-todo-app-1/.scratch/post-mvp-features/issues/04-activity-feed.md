# 04 — Activity feed + taxonomy emissions

**What to build:** Every board Member can open a dedicated **Activity feed** page for the board (newest → oldest, 20/page, "load older") and see high-signal history only: board renamed · member invited/joined/removed/left · todo created/deleted/status changed/assignee changed · tag created/deleted (plus comment events already emitted by 02/03 once those land). Field-level edits and reorders never appear (ADR-0002). Existing MVP mutations start emitting Activity rows transactionally with their domain writes. Entries cascade with the board; a deleted actor renders as "Former member". Membership-gated reads; compliance columns (resource type/id, actor, timestamp, IP) populated from day one.

**Blocked by:** 01 — Post-launch schema

**Status:** done

- [x] Dedicated board Activity route/page exists, reachable from board navigation, membership-gated like board detail (non-members rejected)
- [x] Feed is newest → oldest, 20 per page, progressive/infinite loading — never fetches the full log
- [x] Taxonomy emissions wired into existing MVP mutations (atomic with the domain change): board rename; member invite/accept/remove/leave; todo create/delete/status change/assignee change; tag create/delete — each writes action, resource type/id, actor, board, best-effort IP
- [x] Mutations outside the taxonomy (title/priority/due-date edits, reorders, etc.) emit **no** Activity row
- [x] Deleting a board removes its Activity entries (cascade); no orphaned feed — covered by the existing cascade assertion in `prisma/__tests__/schema.test.ts`
- [x] Null actor (account erased) is representable and surfaced to the UI as "Former member"; member-removed-but-account-alive still joins the actor's name
- [x] Server-entrypoint tests: feed order/page/membership; each in-taxonomy mutation persists the expected Activity row; an out-of-taxonomy mutation persists none — external behavior only, per prior art
