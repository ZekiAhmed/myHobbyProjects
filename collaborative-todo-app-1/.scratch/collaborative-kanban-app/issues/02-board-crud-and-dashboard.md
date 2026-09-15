# 02 — Board CRUD & Dashboard

**What to build:** Create, rename, and delete boards. Dashboard page showing all boards the user owns or is a member of, with board cards displaying name, member count, and open todo count. TanStack Query wired with prefetching and hydration.

**Blocked by:** 01

**Status:** done

## Implementation Notes

- **Data fetching pattern:** Dashboard page (`/`) uses Server Component → props pattern instead of HydrationBoundary. This avoids the cookie-forwarding issue with internal fetch() calls. The shared `fetchBoards()` function in `lib/queries/boards.ts` is used by both the Server Component and the API Route.
- **Query options:** `boardsQueryOptions()` is defined for client-side use (e.g., useQuery/useSuspenseQuery) but the dashboard currently reads from props. The query options are available for future components that need client-side fetching.
- **Scope:** `boardDetailQueryOptions` and `todosQueryOptions` are deferred to issues 03/04 when the endpoints exist.

## Checklist

- [x] `createBoard(name)` Server Action — creates board, sets current user as owner, revalidates `boards` tag
- [x] `renameBoard(boardId, name)` Server Action — owner only, revalidates `boards` and `board-detail` tags
- [x] `deleteBoard(boardId)` Server Action — owner only, cascades deletion of todos, tags, members, invitations, revalidates `boards` tag
- [x] `GET /api/boards` Route Handler — returns boards where user is owner OR member, includes `_count` for members and open todos
- [x] `fetchBoards(userId)` — shared Prisma query used by Server Component and API Route (prevents duplication)
- [x] `boardsQueryOptions()` — TanStack Query options for fetching boards (staleTime: 30s)
- [x] `boardKeys` — query key factory (`all()`, `detail(id)`, `todos(id)`)
- [x] Dashboard page (`/`) — Server Component queries DB directly, passes data as props to DashboardClient
- [x] `DashboardClient` component — shows "Boards I Own" and "Boards I'm a Member of" sections
- [x] `BoardCard` component — displays board name, member count, open todo count; links to `/boards/[id]`
- [x] `NewBoardModal` component — enter board name, creates board, redirects to `/boards/[id]`
- [x] `QueryProvider` — TanStack Query client provider with devtools (dev only)
