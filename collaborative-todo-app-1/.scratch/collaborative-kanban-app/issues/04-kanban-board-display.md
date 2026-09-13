# 04 — Kanban Board Display

**What to build:** Board detail page with Kanban board showing 3 columns (To Do, In Progress, Done). Todos sorted by fractional index. Filter bar for priority, assignee, tag, due date. Near-real-time polling every 8 seconds. DONE column collapses after 10 items.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `GET /api/boards/[id]` Route Handler — returns board detail, members, and tags in a single `$transaction`
- [ ] `GET /api/boards/[id]/todos` Route Handler — returns todos with assignee and tags, supports `?status=` filter, ordered by fractional index
- [ ] `todosQueryOptions(id)` — TanStack Query options with `refetchInterval: 8000`, `staleTime: 0`
- [ ] `/boards/[id]` page — prefetches board detail and todos, renders `HydrationBoundary` with `KanbanBoard`
- [ ] `KanbanBoard` component — `'use client'`, DndContext root, renders 3 `KanbanColumn` components
- [ ] `KanbanColumn` component — SortableContext per column, renders `TodoCard` components, shows column header with todo count
- [ ] `TodoCard` component — displays title, priority badge, due date, assignee avatar, tag chips; click opens side panel
- [ ] `FilterBar` component — client-side filter controls for priority, assignee, tag, due date; filters over already-loaded board data
- [ ] DONE column collapse — shows first 10 DONE todos, "View all completed" expand button to show rest
- [ ] `listDetailQueryOptions` renamed to `boardDetailQueryOptions` in queries