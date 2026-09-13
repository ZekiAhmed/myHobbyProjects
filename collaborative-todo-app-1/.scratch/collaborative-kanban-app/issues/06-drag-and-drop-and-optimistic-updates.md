# 06 — Drag-and-Drop & Optimistic Updates

**What to build:** Drag-and-drop reordering within a column and across columns. Optimistic updates with rollback on error. Toast notification on failure. Atomic `$transaction` for cross-column status + order updates.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `updateTodoOrder(todoId, newOrder)` Server Action — updates fractional index, revalidates `todos` tag
- [ ] `updateTodoStatusAndOrder(todoId, newStatus, newOrder)` Server Action — atomic `$transaction` updating both status and order, revalidates `todos` tag
- [ ] `KanbanBoard` updated with DndContext — sensors for pointer and keyboard, collision detection
- [ ] `KanbanColumn` updated with SortableContext — wraps todos in sortable context
- [ ] `TodoCard` updated as draggable — use `useSortable` hook, drag overlay for visual feedback
- [ ] Within-column drag — `onDragEnd` handler calls `updateTodoOrder`, optimistic update via `onMutate` updates fractional index in client cache
- [ ] Cross-column drag — `onDragEnd` handler calls `updateTodoStatusAndOrder`, optimistic update via `onMutate` updates both status and order in client cache
- [ ] Quick-complete optimistic update — `onMutate` moves todo to DONE column immediately, rollback on error
- [ ] Rollback pattern — `onMutate` returns `{ previous }` context, `onError` restores previous cache state + shows toast
- [ ] `onSettled` — always invalidate `boardKeys.todos(boardId)` after mutation completes (success or failure)
- [ ] Drag overlay component — shows a copy of the card being dragged for visual feedback