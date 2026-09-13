# 02 — Board CRUD & Dashboard

**What to build:** Create, rename, and delete boards. Dashboard page showing all boards the user owns or is a member of, with board cards displaying name, member count, and open todo count. TanStack Query wired with prefetching and hydration.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `createBoard(name)` Server Action — creates board, sets current user as owner, revalidates `boards` tag
- [ ] `renameBoard(boardId, name)` Server Action — owner only, revalidates `boards` and `board-detail` tags
- [ ] `deleteBoard(boardId)` Server Action — owner only, cascades deletion of todos, tags, members, invitations, revalidates `boards` tag
- [ ] `GET /api/boards` Route Handler — returns boards where user is owner OR member, includes `_count` for members and open todos
- [ ] `boardsQueryOptions()` — TanStack Query options for fetching boards (staleTime: 30s)
- [ ] `boardKeys` — query key factory (`all()`, `detail(id)`, `todos(id)`)
- [ ] Dashboard page (`/`) — prefetches boards, renders `HydrationBoundary` with `DashboardClient`
- [ ] `DashboardClient` component — shows "Boards I Own" and "Boards I'm a Member of" sections
- [ ] `BoardCard` component — displays board name, member count, open todo count; links to `/boards/[id]`
- [ ] `NewBoardModal` component — enter board name, creates board, redirects to `/boards/[id]`
- [ ] `QueryProvider` — TanStack Query client provider with devtools (dev only)