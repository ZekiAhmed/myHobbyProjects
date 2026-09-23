# Debug Journal 02: `todos.filter is not a function` (Error JSON Resolved as Success Data)

**Date:** 2026-09-23
**Severity:** High — board page crashes in the browser; Kanban unusable
**Files affected:** `lib/queries/board-keys.ts`, `components/board/KanbanBoard.tsx`
**Related issue:** None (found via dev-server logs during live QA)

---

## Symptom

Uncaught browser TypeError:

```
TypeError: todos.filter is not a function
    at KanbanBoard.useMemo[filteredTodos] (components/board/KanbanBoard.tsx:186:43)
```

Server logs at the same moment showed the triggers:

```
GET /api/boards/cmu1xspoa0000g4tu9a92yo8d 403 in 21.6s
PrismaClientKnownRequestError P1001 Can't reach database server at ep-polished-shape-...
ERROR [Better Auth]: INTERNAL_SERVER_ERROR ... code: 'FAILED_TO_GET_SESSION'
```

The page received a **JSON object** (`{ error: '...' }` or `{ message: '...' }`) where
TanStack Query expected an **array of todos**. `(todos as TodoWithRelations[]).filter(...)`
then threw.

---

## Phase 1–2: Feedback Loop & Reproduction

### Seam chosen

`todosQueryOptions().queryFn` in `lib/queries/board-keys.ts` — the single function that
turns HTTP responses into query `data`. Call site: `KanbanBoard.tsx:186`.

### Loop

`lib/queries/__tests__/board-keys.test.ts` — mock `fetch`, drive `queryFn`, assert it
**never resolves a non-array** (rejection keeps `useQuery` `data === undefined` → default
`[]` → no crash).

### First run (red)

```
pnpm test:run lib/queries/__tests__/board-keys.test.ts
→ 5 failed | 2 passed

FAIL rejects on 403 error body — promise resolved "{ error: 'Forbidden...' }" instead of rejecting
FAIL rejects on 500 error body — promise resolved "{ code: 'FAILED_TO_GET_SESSION' }" instead of rejecting
FAIL simulates KanbanBoard consumption: TypeError: todos.filter is not a function
```

Exact user symptom reproduced in the consumption test. Deterministic, ~1.6s, agent-runnable.

### Minimise

Cut to: mock fetch → `queryFn` → `.filter`. Every element load-bearing (200-path test stays
green; non-OK paths red).

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | `queryFn` never checks `r.ok` — `fetch().then(r => r.json())` resolves 403/500 bodies as success | Adding `if (!r.ok) throw` greens all 5 red tests with no other change | **Correct** |
| 2 | Server `prefetchQuery` hydrates the bad object into the client cache before paint | Same `queryFn` fix still greens the loop (shared function); removing prefetch alone would not | Contributing path, same fix |
| 3 | Neon `P1001` DB outage is the cause, not the bug | DB recovery alone never touches the loop; loop stays red until `queryFn` checks `ok` | Trigger only |
| 4 | Legitimate 403 (not a member) consumed as data | Loop already covers 403; only `r.ok` check greens it | Same as #1 |
| 5 | Optimistic `setQueryData` returns a non-array | Loop doesn't exercise mutations; mappers already guard `if (!old)` | Rejected (ranked low) |

**Showed list to user context; proceeded with #1** (loop was waiting on it).

---

## Phase 4: Instrumentation

No `[DEBUG-...]` logs — the vitest loop *was* the instrument. One variable changed at a
time: the `r.ok` guard inside a shared `fetchJson` helper.

---

## Root Cause

**File:** `lib/queries/board-keys.ts` (all four `queryFn`s)

**Cause:** Every client query used:

```ts
queryFn: () => fetch(`/api/boards/${id}/todos`).then(r => r.json()),
```

`fetch` only rejects on network failure. A 403/500 with a JSON body **resolves**. TanStack
stores that object as `data`. `KanbanBoard` does `(todos as TodoWithRelations[]).filter(...)` →
TypeError.

**Why 403/500 appeared in logs:** membership denials and Neon connectivity failures
(`P1001` → Better Auth `FAILED_TO_GET_SESSION`) returned error JSON bodies that the client
treated as todo lists.

---

## Fixes Applied

### Fix: shared `fetchJson` that fails loudly on non-2xx

```ts
// Before (board-keys.ts — repeated 4×)
queryFn: () => fetch(`/api/boards/${id}/todos`).then(r => r.json()),

// After
async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      detail = body.error || body.message || ''
    } catch { /* non-JSON body */ }
    throw new Error(detail || `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Used by boardsQueryOptions, boardDetailQueryOptions,
// invitationsQueryOptions, todosQueryOptions
queryFn: () => fetchJson<TodoWithRelations[]>(`/api/boards/${id}/todos`),
```

**Why throw:** TanStack leaves `data === undefined` on error → consumers' `data = []`
defaults apply → no crash; errors surface via `isError` + `retry: 3`.

Typing: `fetchJson<Board[]>`, `fetchJson<BoardDetail>`, etc. — preserves prior `any`
consumer behavior without `@typescript-eslint/no-explicit-any`.

---

## Verification

| Check | Result |
|---|---|
| Feedback loop (was 5 red) | 7/7 pass |
| Full suite | 16/16 → later 34/34 as suites grew |
| `tsc --noEmit` | 0 |
| `eslint` | 0 |
| Other bare `.then(r => r.json())` | none remain |

**Regression tests:** `lib/queries/__tests__/board-keys.test.ts` — 403/500/404 must reject;
KanbanBoard `.filter` consumption path; board-detail same pattern.

---

## Post-Mortem

### What would have prevented this

1. **A shared HTTP helper with an `ok` check from day one** — four call sites repeated the
   same unsafe pattern. Now centralized as `fetchJson`.
2. **Types on query options** — `unknown`/`any` masked the fact that error bodies were
   being stored where `TodoWithRelations[]` was expected.
3. **Feedback-loop-first discipline** — unlike Debug Journal 01, this session started with
   a red-capable vitest command before hypothesising. Root cause fell out of the first
   failing assertion.

### Follow-ups (not fixed here)

- **Neon `P1001` / `DatabaseNotReachable`** is an infra issue (network/credentials/sleeping
  pooler). The client no longer *crashes* on the resulting 500s, but the outage remains.
- The **403 membership denials** were correct API behavior for non-members; page/API
  consistency is covered in Debug Journal 03.

---

## Cleanup

No `[DEBUG-...]` instrumentation was added. Test file remains as the permanent regression
loop. No throwaway scripts.
