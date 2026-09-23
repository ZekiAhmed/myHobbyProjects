# 03 — Comment lifecycle (edit / hard delete)

**What to build:** Comment authors can edit their own Comment (feed reflects current text). Authors can delete their own Comment; the board **Owner** can delete any Comment on their board; anyone else cannot. Deletion is **hard delete** — the row is gone, no tombstone (ADR-0001) — and emits an Activity entry recording that a comment was deleted (who/when/which todo; never the body). After account deletion, prior comment-related Activity shows "Former member" via the null actor already designed.

**Blocked by:** 01 — Post-launch schema; 02 — Todo Comment feed

**Status:** ready-for-agent

- [ ] Author can edit own Comment body; edit succeeds and feed shows updated text with updated timestamp
- [ ] Non-author Member cannot edit (and cannot delete) another's Comment — rejected at the server entrypoint
- [ ] Author can delete own Comment; Owner can delete any Comment on their board; unrelated Member cannot delete
- [ ] Delete removes the Comment row outright (hard delete; no `deletedAt`/tombstone) — subsequent feed pages omit it entirely
- [ ] Comment deletion atomically emits an Activity entry (comment deleted, actor, todo resource) without the body
- [ ] Board Owner's delete-any power does not extend to editing others' Comment bodies (Owner ≠ co-author)
- [ ] Server-entrypoint tests cover the full authorization matrix (author / Owner / unrelated Member / non-member) for edit and delete, hard-delete row absence, and Activity emission on delete — external behavior only
