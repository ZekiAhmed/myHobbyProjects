# 03 — Comment lifecycle (edit / hard delete)

**What to build:** Comment authors can edit their own Comment (feed reflects current text). Authors can delete their own Comment; the board **Owner** can delete any Comment on their board; anyone else cannot. Deletion is **hard delete** — the row is gone, no tombstone (ADR-0001) — and emits an Activity entry recording that a comment was deleted (who/when/which todo; never the body). After account deletion, prior comment-related Activity shows "Former member" via the null actor already designed.

**Blocked by:** 01 — Post-launch schema; 02 — Todo Comment feed

**Status:** done

- [x] Author can edit own Comment body; edit succeeds and feed shows updated text with updated timestamp
- [x] Non-author Member cannot edit (and cannot delete) another's Comment — rejected at the server entrypoint
- [x] Author can delete own Comment; Owner can delete any Comment on their board; unrelated Member cannot delete
- [x] Delete removes the Comment row outright (hard delete; no `deletedAt`/tombstone) — subsequent feed pages omit it entirely
- [x] Comment deletion atomically emits an Activity entry (comment deleted, actor, todo resource) without the body
- [x] Board Owner's delete-any power does not extend to editing others' Comment bodies (Owner ≠ co-author)
- [x] Server-entrypoint tests cover the full authorization matrix (author / Owner / unrelated Member / non-member) for edit and delete, hard-delete row absence, and Activity emission on delete — external behavior only

## Comments

- **Authorization matrix** resolved in one shared lookup (`findCommentForModeration`): load Comment → board via its Todo → membership check (Owner or `BoardMember` row) → then the per-action rule. Edit: author only (`authorId === session.user.id`); the Owner is rejected with "You can only edit your own comments" — Owner ≠ co-author. Delete: author **or** Owner; anyone else gets an authorization error before any write.
- **Activity on delete** is written in the same `$transaction` as `comment.delete` (ADR-0001): `action: 'comment.deleted'`, `actorId`, best-effort `ipAddress`, `boardId` — and deliberately **no body** (it is gone for good). The ticket and ADR both require the entry to record *which todo* ("who/when/which todo"), so the resource is `resourceType: 'TODO'` + `resourceId: <todoId>`: the Comment row no longer exists at read time, so a `COMMENT/<commentId>` pointer would dangle. (`comment.created` from issue 02 keeps `COMMENT/<commentId>` — that row is joinable to its todo.) Edit emits **no** Activity: comment edits are outside the ADR-0002 taxonomy (field-level noise).
- **Hard delete** = `prisma.comment.delete({ where: { id } })` only — no `update`, no `deletedAt`, no `data` payload. Feed reads (`GET /api/todos/[id]/comments`) need no change: the row simply stops existing.
- **"Former member" after account deletion** needs no new code: `Activity.actorId` is `SetNull` in the schema (TRD §12), so the designed Activity-feed rendering (issue 04) covers comment-deleted entries too.
- **Edited indicator** (PRD user story 5): the feed renders `Edited <timestamp>` when `updatedAt` has moved past `createdAt` (2s tolerance — `createdAt` is DB-clock, `updatedAt` is app-clock, so fresh rows must not false-positive); `updatedAt` moves on every successful edit via Prisma's `@updatedAt`.
- **UI:** `CommentFeed.tsx` shows Edit (inline textarea + Save/Cancel) only on the viewer's own Comments, and Delete (AlertDialog confirm) on own Comments for authors plus **every** Comment for the Owner. `currentUserId` and `isOwner` are threaded `KanbanBoard` (already computes `isOwner` at line 367) → `TodoSidePanel` → `CommentFeed`. Mutations follow the two-cache invalidation rule (server `revalidateTag('comments','max')` + client `invalidateQueries(boardKeys.comments(...))`).
- **Shipped:** `actions/comments.ts` (`updateComment`, `deleteComment`, `findCommentForModeration`), `components/board/CommentFeed.tsx`, prop threading in `components/board/TodoSidePanel.tsx` + `components/board/KanbanBoard.tsx`. 14 new tests at the server-entrypoint seam (20 in the file); `npx tsc --noEmit`, `npx eslint`, and the full Vitest suite (79 tests) pass.
