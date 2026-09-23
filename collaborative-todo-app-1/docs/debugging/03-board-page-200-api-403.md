# Debug Journal 03: Board Page 200 While APIs 403 (Missing Membership Gate)

**Date:** 2026-09-24
**Severity:** High — authorization inconsistency; stranger gets a board shell, data APIs refuse
**Files affected:** `app/(app)/boards/[id]/page.tsx`
**Related issue:** Continuation of session that produced Debug Journal 02 logs

---

## Symptom

Dev-server logs for the same session and board id:

```
GET /boards/cmu1xspoa0000g4tu9a92yo8d           200 in 9.6s
GET /api/boards/cmu1xspoa0000g4tu9a92yo8d/todos 403 in 883ms
GET /api/boards/cmu1xspoa0000g4tu9a92yo8d       403 in 1108ms
```

Prisma traces showed session resolution succeeded, the board row existed, membership
lookups ran — yet both APIs returned **403 Forbidden**. The **page still returned 200**.

User-visible effect: empty/broken Kanban shell while client queries fail with 403
(after Journal 02, without the crash — `fetchJson` throws; `data` stays `[]`).

---

## Phase 1–2: Feedback Loop & Reproduction

### Loop A — API handler contract (green from the start)

`app/api/boards/[id]/__tests__/authz.test.ts`

Mock `getRequiredSession` + `prisma`; call `GET` handlers directly:

| Principal | Expect |
|---|---|
| Owner | 200 (board + todos) |
| Member | 200 |
| Stranger | 403 |
| Missing board | 404 |

**First run: 9/9 pass.** The routes implement owner-or-member correctly when DB says so.
Wrong seam for *this* symptom — handlers were not the bug.

### Loop B — page/API consistency (red)

`app/(app)/boards/[id]/__tests__/page.test.ts`

Mock session, prisma, query options, `notFound`/`redirect`. Call `BoardPage`:

```
pnpm test:run "boards/[id]/__tests__/page"
→ stranger with valid session: RED — promise resolved <HydrationBoundary…KanbanBoard currentUserId="user_stranger">
→ missing board: RED — resolved instead of NEXT_NOT_FOUND
→ owner / member: green
```

**Exact symptom:** session OK → page would HTTP 200 while APIs 403. Minimised to:
session + board exists + not owner/member → page must deny.

### Loop hardening

Initial page test timed out (5s) on real `prefetchQuery` → `fetch`. Mocked
`@/lib/queries/board-keys` so prefetch is instant and deterministic (~2.7s full file).

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | `BoardPage` only calls `getRequiredSession()` — no membership check; APIs enforce owner-or-member | Adding the same gate greens stranger/missing-board tests | **Correct** |
| 2 | Session principal is genuinely not owner/member (removed, wrong account, old link) | #1 still correct: page should deny like API 403; DB may be right | Data question, same fix |
| 3 | `ownerId !== session.user.id` despite creator (ID mismatch / transfer) | Logging both IDs at API 403 would show mismatch; #1 still fixes page inconsistency | Not needed for page bug |
| 4 | Accept-invite marked accepted but `boardMember.create` failed | Board-detail still loads other members → you'd look like a stranger | Same as #2 from API view |

**Proceeded with #1** — loop red on it; #2–4 are data investigations the same gate handles.

---

## Phase 4: Instrumentation

No `[DEBUG-...]` logs. Distinguishing evidence was already in the supplied logs:

- Page path: `getRequiredSession` only → 200.
- API path: session + `board.ownerId === session.user.id` + `members.some(...)` → 403.
- Settings page **already** called `notFound()` / `redirect()` for non-owners — board page
  was the outlier.

---

## Root Cause

**File:** `app/(app)/boards/[id]/page.tsx`

**Cause:** The Server Component authenticated but never authorized:

```ts
const session = await getRequiredSession()
// …straight to prefetch + render — no owner/member check
```

APIs correctly returned 403 for non-members. The page rendered a 200 shell for anyone
with a session cookie. Settings (`settings/page.tsx`) already gated on `isOwner`; the board
page had no equivalent of the API’s owner-or-member rule.

**Hypothesis #2 note:** a 403 from the API can also mean the DB says you are not a member.
That is correct API behavior; the bug was the page disagreeing with the API.

---

## Fixes Applied

### Fix: authorize before prefetch (same rule as APIs)

```tsx
// Before
export default async function BoardPage({ params }) {
  const { id } = await params
  const session = await getRequiredSession()
  const queryClient = new QueryClient()
  await Promise.all([ /* prefetch */ ])
  return ( /* HydrationBoundary → KanbanBoard */ )
}

// After
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function BoardPage({ params }) {
  const { id } = await params
  const session = await getRequiredSession()

  const board = await prisma.board.findUnique({
    where: { id },
    select: { ownerId: true, members: { select: { userId: true } } },
  })
  if (!board) notFound()
  const isOwner = board.ownerId === session.user.id
  const isMember = board.members.some((m) => m.userId === session.user.id)
  if (!isOwner && !isMember) notFound()  // match API 403 — do not render shell

  const queryClient = new QueryClient()
  await Promise.all([ /* prefetch */ ])
  return ( /* … */ )
}
```

`notFound()` yields 404 (no board-info leak) rather than a branded 403 page — consistent
with settings’ missing-board path.

---

## Verification

| Check | Result |
|---|---|
| Page loop (was 2 red) | 4/4 pass |
| API authz loop | 9/9 pass |
| Full suite | 29/29 (at time of fix) |
| `tsc --noEmit` | 0 |
| `eslint` | 0 |
| `[DEBUG-…]` leftovers | none |

**Regression tests:** `app/(app)/boards/[id]/__tests__/page.test.ts` + existing
`authz.test.ts` — page and API now agree on owner / member / stranger / missing.

---

## Post-Mortem

### What would have prevented this

1. **One shared `canAccessBoard(session, board)` helper** used by page, settings, and both
   API routes. Authz was copy-pasted per surface; the RSC that *renders* the shell was the
   one that missed it. (Architectural handoff candidate: `/improve-codebase-architecture`.)
2. **Contract tests that assert page and API status codes together** for the same
   principal — Loop B is that test; it should run in CI.
3. **Symmetry with settings** — `settings/page.tsx` already did `notFound()`/`redirect()`;
   grepping for `getRequiredSession` without a follow-on membership check would have
   flagged the board page.

### Skill process note

Loop A (handlers) was green — easy to falsely declare victory. Tightening to the *user’s
exact symptom* (page 200 vs API 403) produced Loop B, which went red. **A green loop on
the wrong seam is not a green bug.**

---

## Cleanup

No `[DEBUG-...]` instrumentation. Both test files remain as permanent regression loops.
No throwaway scripts.
