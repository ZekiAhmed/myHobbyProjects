# 05 — Todo CRUD & Side Panel

**What to build:** Create, edit, and delete todos via a side panel. All fields: title, description, status, priority, due date, assignee, tags. Quick-complete ✓ button for instant status change.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `createTodo(boardId, data)` Server Action — creates todo with all fields, revalidates `todos` tag
- [ ] `updateTodo(todoId, data)` Server Action — updates todo fields, revalidates `todos` tag
- [ ] `deleteTodo(todoId)` Server Action — deletes todo, revalidates `todos` tag
- [ ] `quickCompleteTodo(todoId)` Server Action — sets status to DONE, revalidates `todos` tag
- [ ] `TodoSidePanel` component — slide-in panel with create and edit modes
- [ ] Side panel form fields: title (required), description (textarea), status (dropdown), priority (dropdown), due date (date picker), assignee (dropdown of board members), tags (multi-select from board tags)
- [ ] Side panel close behavior — close on Escape, close on backdrop click, close after successful submit
- [ ] Delete todo button in side panel (edit mode) — shows confirmation dialog, member or owner can delete
- [ ] Quick-complete ✓ button on `TodoCard` — calls `quickCompleteTodo`, optimistic update moves card to Done column
- [ ] `fractional-indexing` wrapper (`lib/utils/fractional-indexing.ts`) — `generateKeyBetween` with edge-case guards for column start/end and empty columns