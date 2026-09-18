# Debug Journal 01: Drag-and-Drop Status Revert Bug

**Date:** 2026-09-19
**Severity:** High — core feature completely broken
**Files affected:** `components/board/KanbanBoard.tsx`
**Related issue:** `.scratch/collaborative-kanban-app/issues/06-drag-and-drop-and-optimistic-updates.md`

---

## Symptom

When dragging a todo card from one column to another (e.g., To Do → In Progress), the card
moves visually during the drag, but **reverts to its original column within ~8 seconds**.
The 8-second polling interval (`refetchInterval: 8_000` in `board-keys.ts:171`) fetches
fresh data from the API, which returns the unchanged database state, overwriting the
optimistic cache update.

---

## Phase 1–2: Feedback Loop & Reproduction

### Initial approach (wrong)

We jumped straight to code analysis and hypothesised three root causes without building a
feedback loop. All three hypotheses were wrong:

1. **Wrong:** "Mutation error not thrown" — we added `throw` on error, but the mutation
   was never being *called* in the first place.
2. **Wrong:** "Stale closure in handleDragEnd" — we switched from `todos` to
   `queryClient.getQueryData()`, but the real issue was that `handleDragEnd` itself
   never fired.
3. **Wrong:** "handleDragOver overwrites cache" — we read from cache instead of closure,
   but this didn't address the fundamental problem.

### What finally worked: targeted instrumentation

We added `[DEBUG-...]` tagged `console.log` statements at every boundary:

```
[DEBUG-c3d4] handleDragOver — fires during drag
[DEBUG-e5f6] handleDragEnd — fires on drop
[DEBUG-a1b2] reorderMutation — mutation lifecycle
[DEBUG-x7y8] completeMutation — quick-complete lifecycle
```

### Key log output (first capture)

```
[DEBUG-c3d4] handleDragOver moving: cmu67zqiv0001m4tu09dilzn5 TO_DO -> IN_PROGRESS
```

**Only `handleDragOver` fired. `handleDragEnd` never fired.** The mutation was never
called. The database was never updated. Polling reverted the todo.

---

## Phase 3: Hypotheses (revised after instrumentation)

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | `DragOverlay` consumes pointer-up event, preventing drop detection | Adding `pointerEvents: 'none'` will make `handleDragEnd` fire | **Correct** |
| 2 | `over` target is the todo itself, not the column | `activeId === overId` causes early return | **Correct** (discovered after fix #1) |
| 3 | Stale closure reads wrong status | Reading from query cache fixes detection | Partially correct — needed alongside #1 and #2 |

---

## Phase 4: Instrumentation Details

### Debug tags used

| Tag | Location | Purpose |
|-----|----------|---------|
| `[DEBUG-c3d4]` | `handleDragOver` (start + cross-column block) | Track visual drag moves |
| `[DEBUG-e5f6]` | `handleDragEnd` (start + branches) | Track drop detection and branch taken |
| `[DEBUG-a1b2]` | `reorderMutation` (mutationFn, onMutate, onError, onSettled) | Track server round-trip |
| `[DEBUG-x7y8]` | `completeMutation` (mutationFn, onMutate, onError, onSettled) | Track quick-complete flow |

### Second capture (after DragOverlay fix)

```
[DEBUG-c3d4] handleDragOver FIRED {active: 'cmu67zqiv0001m4tu09dilzn5', over: 'IN_PROGRESS'}
[DEBUG-c3d4] handleDragOver moving: cmu67zqiv0001m4tu09dilzn5 TO_DO -> IN_PROGRESS
[DEBUG-e5f6] handleDragEnd FIRED {active: 'cmu67zqiv0001m4tu09dilzn5', over: 'cmu67zqiv0001m4tu09dilzn5'}
```

`handleDragEnd` now fires (DragOverlay fix worked), but `over` equals `active` — the
drop lands on the todo itself, not the target column. Line `if (activeId === overId) return`
bails out. Mutation never fires.

### Third capture (after status-comparison fix)

```
[DEBUG-e5f6] CROSS-COLUMN: TO_DO -> IN_PROGRESS
[DEBUG-a1b2] onMutate: {todoId: '...', newStatus: 'IN_PROGRESS', newOrder: 'a1'}
[DEBUG-a1b2] server result: {"success":true,"data":{"status":"IN_PROGRESS",...}}
[DEBUG-a1b2] onSettled — invalidating queries
```

Full flow works end-to-end. Todo stays in new column after polling.

---

## Root Causes (3 bugs)

### Bug 1: `DragOverlay` consumed pointer-up event

**File:** `components/board/KanbanBoard.tsx:488` (original line)
**Cause:** The `DragOverlay` component renders an absolutely-positioned element that
follows the cursor. By default, it captures pointer events, preventing dnd-kit's
collision detection from finding the droppable target column underneath.
**Symptom:** `handleDragEnd` never fires. No mutation. Polling reverts.
**Fix:** `<DragOverlay style={{ pointerEvents: 'none' }}>`

### Bug 2: `over` target was the todo itself

**File:** `components/board/KanbanBoard.tsx:295-300` (original line)
**Cause:** When the user drops, dnd-kit detects the drop target as the original card's
ghost position (still in the DOM with reduced opacity), not the target column. So
`over.id === active.id`, and the early return `if (activeId === overId) return` skips
the mutation entirely.
**Symptom:** Even after Bug 1 was fixed, the mutation was never called because of the
early return.
**Fix:** Cross-column detection now compares `activeOriginalStatus` (captured at drag
start in `handleDragStart`) against the current cache status (updated by `handleDragOver`
during the drag). If they differ, it's a cross-column move — regardless of what `over`
says.

### Bug 3: Stale closure in `handleDragEnd`

**File:** `components/board/KanbanBoard.tsx:282-283` (original line)
**Cause:** `handleDragEnd` read `activeTodo` and `overTodo` from the React closure
`todos`, which is a snapshot from the last render. After `handleDragOver` updates the
query cache during drag, React re-renders, but the closure still captures the
pre-mutation snapshot. This caused incorrect status comparisons.
**Symptom:** Cross-column detection logic compared stale status values, leading to wrong
branch selection.
**Fix:** All reads in `handleDragEnd` now use
`queryClient.getQueryData<TodoWithRelations[]>(boardKeys.todos(boardId))` instead of the
`todos` closure variable.

---

## Fixes Applied

### Fix 1: DragOverlay pointer-events

```tsx
// Before
<DragOverlay>

// After
<DragOverlay style={{ pointerEvents: 'none' }}>
```

### Fix 2: Cross-column detection via original status

```tsx
// Added state to track original status
const [activeOriginalStatus, setActiveOriginalStatus] =
  useState<Todo['status'] | null>(null)

// Captured at drag start
function handleDragStart(event: DragStartEvent) {
  const { active } = event
  setActiveId(active.id as string)
  const currentTodos = queryClient.getQueryData<TodoWithRelations[]>(
    boardKeys.todos(boardId)
  )
  const draggedTodo = currentTodos?.find((t) => t.id === active.id)
  setActiveOriginalStatus(draggedTodo?.status ?? null)
}

// Compared in handleDragEnd
if (activeOriginalStatus && currentStatus !== activeOriginalStatus) {
  // Cross-column move — persist to server
  reorderMutation.mutate({ todoId: activeId, newStatus: currentStatus, ... })
}
```

### Fix 3: Query cache reads instead of closure

```tsx
// Before
const activeTodo = (todos as TodoWithRelations[]).find((t) => t.id === activeId)

// After
const currentTodos = queryClient.getQueryData<TodoWithRelations[]>(
  boardKeys.todos(boardId)
) as TodoWithRelations[] | undefined
const activeTodo = currentTodos?.find((t) => t.id === activeId)
```

### Fix 4: Mutation error handling (server actions return errors, don't throw)

```tsx
// Before
mutationFn: (todoId) => quickCompleteTodo(todoId),

// After
mutationFn: async (todoId) => {
  const result = await quickCompleteTodo(todoId)
  if (!result.success) throw new Error(result.error.message)
  return result
},
```

Applied to both `completeMutation` and `reorderMutation`. Server actions return
`{ success: false, error }` on failure instead of throwing. TanStack Query only
triggers `onError` (which rolls back optimistic updates) when `mutationFn` throws.

---

## Post-Mortem

### What would have prevented this

1. **A Playwright drag-and-drop test** that drags a todo across columns, waits for the
   polling interval, and asserts the todo stays in the new column. This would have caught
   all three bugs immediately.

2. **dnd-kit documentation** — the `DragOverlay` pointer-events issue is a known gotcha.
   Adding a note in `docs/TRD.md` or a new `ARCHITECTURE.md` under the "Drag and Drop"
   section would prevent recurrence.

3. **Instrumentation-first approach** — we spent significant time on wrong hypotheses
   before building a feedback loop. The `diagnosing-bugs` skill says: "No red-capable
   command, no Phase 2." We should have started with `console.log` instrumentation
   instead of code analysis.

### dnd-kit gotchas (for future reference)

| Gotcha | Description | Prevention |
|--------|-------------|------------|
| `DragOverlay` captures pointer events | The overlay is absolutely positioned and can intercept drop events | Always add `style={{ pointerEvents: 'none' }}` to `<DragOverlay>` |
| `over` target may be the dragged item itself | Drop can land on the original card's ghost, not the target column | Don't rely solely on `over` for cross-column detection; compare status before/after |
| `handleDragOver` mutates cache during drag | React closures capture stale snapshots | Read from `queryClient.getQueryData()` in `handleDragEnd`, not from closure variables |
| Server actions return errors, don't throw | TanStack Query `onError` only fires on thrown errors | Always check `result.success` and throw in `mutationFn` |
| Polling overwrites optimistic updates | 8-second `refetchInterval` refetches from DB | If mutation didn't persist, polling will revert — ensure mutations actually call the server |

---

## Cleanup

All `[DEBUG-...]` instrumentation was removed after verification. No debug artifacts
remain in the codebase.
