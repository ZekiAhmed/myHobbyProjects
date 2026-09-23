# 02 — Todo Comment feed

**What to build:** A board Member opens a Todo in the side panel and reads a **Comment feed** — plain text with preserved line breaks, oldest → newest, first 20 loaded with an explicit **"Load older"** control for the rest. The same Member can post a new Comment; it appears in the feed. Non-members are rejected with the same authorization posture as other todo mutations. Posting a Comment emits an Activity entry (comment created) so the moderation trail starts complete. Vocabulary: Comment, Comment feed per `CONTEXT.md`.

**Blocked by:** 01 — Post-launch schema

**Status:** ready-for-agent

- [ ] Any board Member (and Owner) can create a plain-text Comment on a Todo via a server entrypoint; newline-preserving body stored
- [ ] Comment feed read is membership-gated (same check as board detail); non-members cannot list or post even with a valid Todo id
- [ ] Feed returns oldest → newest, 20 per page, with a continuation contract for "Load older" (infinite/progressive loading — never full-list fetch)
- [ ] Feed renders inside the Todo side panel with the "Load older" control when more pages exist
- [ ] Comment creation atomically emits an Activity row (comment created, actor, resource) alongside the domain write
- [ ] Server-entrypoint tests cover: authorized create, rejected non-member create, page order and boundary, membership rejection on read — external behavior only, dependencies mocked per prior art
- [ ] Mutations follow the two-cache invalidation rule (server revalidate + client invalidate) so the feed cannot go stale
