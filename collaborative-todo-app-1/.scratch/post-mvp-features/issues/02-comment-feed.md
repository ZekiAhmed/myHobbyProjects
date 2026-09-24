# 02 — Todo Comment feed

**What to build:** A board Member opens a Todo in the side panel and reads a **Comment feed** — plain text with preserved line breaks, oldest → newest, first 20 loaded with an explicit **"Load older"** control for the rest. The same Member can post a new Comment; it appears in the feed. Non-members are rejected with the same authorization posture as other todo mutations. Posting a Comment emits an Activity entry (comment created) so the moderation trail starts complete. Vocabulary: Comment, Comment feed per `CONTEXT.md`.

**Blocked by:** 01 — Post-launch schema

**Status:** done

- [x] Any board Member (and Owner) can create a plain-text Comment on a Todo via a server entrypoint; newline-preserving body stored
- [x] Comment feed read is membership-gated (same check as board detail); non-members cannot list or post even with a valid Todo id
- [x] Feed returns oldest → newest, 20 per page, with a continuation contract for "Load older" (infinite/progressive loading — never full-list fetch)
- [x] Feed renders inside the Todo side panel with the "Load older" control when more pages exist
- [x] Comment creation atomically emits an Activity row (comment created, actor, resource) alongside the domain write
- [x] Server-entrypoint tests cover: authorized create, rejected non-member create, page order and boundary, membership rejection on read — external behavior only, dependencies mocked per prior art
- [x] Mutations follow the two-cache invalidation rule (server revalidate + client invalidate) so the feed cannot go stale

## Comments

- **Pagination direction:** "first 20 loaded with an explicit 'Load older' control for the rest" pairs with PRD §4.1 ("oldest → newest, 20/page … 'Load older' button at the top of the feed") only if page one is the newest 20-comment window and "Load older" prepends the previous window. User story 9's literal "load the oldest 20 first" is self-contradictory with a top "Load older" control (nothing older would exist to load) and with its own rationale ("page back through history deliberately"), so the ticket is implemented as: newest window first, items displayed oldest → newest, older pages prepended.
- **Validation:** whitespace-only bodies rejected server-side; no body length cap (spec is silent — pasted logs/story 3 must not be truncated).
- **Cursor scoping:** `?before=` cursors are looked up scoped to the todo, so a cursor id from another todo returns 400 rather than skewing pages.
- **Shipped:** `actions/comments.ts` (createComment), `app/api/todos/[id]/comments/route.ts` (feed read), `components/board/CommentFeed.tsx` (feed + composer in the side panel), `commentFeedQueryOptions` in `lib/queries/board-keys.ts`. 14 new tests at the server-entrypoint seam; `npx tsc --noEmit`, `npx eslint`, and the full Vitest suite (65 tests) pass.
