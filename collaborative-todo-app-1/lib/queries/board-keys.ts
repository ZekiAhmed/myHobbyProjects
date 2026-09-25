/**
 * @fileoverview Board Query Keys & Client-Side Query Options
 *
 * This file contains:
 * 1. Query Key Factory — consistent cache keys for board data
 * 2. TanStack Query Options — client-side fetch configuration
 *
 * IMPORTANT: This is a CLIENT-SAFE file.
 * It does NOT import Prisma or any Node.js-only modules.
 * It can be safely imported by Client Components.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-options
 */

import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type {
  ActivityFeedPage,
  Board,
  BoardDetail,
  CommentFeedPage,
  NotificationFeedPage,
  TodoWithRelations,
} from '@/lib/types'

/**
 * Fetch JSON and fail loudly on non-2xx responses.
 *
 * WHY: `fetch().then(r => r.json())` treats a 403/500 JSON error body as
 * success data. TanStack Query then stores that object, and consumers that
 * assume an array (e.g. KanbanBoard's todos.filter) crash with
 * "todos.filter is not a function". Rejecting keeps query data undefined
 * so default fallbacks ([] / null) apply and errors surface via isError.
 */
async function fetchJson<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { error?: string; message?: string }
      detail = body.error || body.message || ''
    } catch {
      // non-JSON error body — status alone is enough
    }
    throw new Error(detail || `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * Query Key Factory for Board Data
 *
 * WHY A KEY FACTORY?
 * - Ensures consistent query keys across the entire app
 * - Prevents typos (e.g., 'board' vs 'boards')
 * - Makes cache invalidation easier (invalidate all board queries at once)
 * - Type-safe: TypeScript knows the shape of each key
 *
 * QUERY KEY STRUCTURE:
 * - boardKeys.all()             → ['boards']                         (list of all boards)
 * - boardKeys.detail(id)        → ['boards', boardId]                (single board details)
 * - boardKeys.todos(id)         → ['boards', boardId, 'todos']       (todos for a board)
 * - boardKeys.invitations(id)   → ['boards', boardId, 'invitations'] (pending invitations)
 * - boardKeys.activity(id)      → ['boards', boardId, 'activity']     (Activity feed)
 * - boardKeys.comments(b, t)    → ['boards', b, 'todos', t, 'comments'] (Comment feed of one todo)
 *
 * The nested structure allows TanStack Query to invalidate related queries:
 * - Invalidating ['boards'] invalidates ALL board queries
 * - Invalidating ['boards', 'abc123'] invalidates only that specific board
 *
 * @example
 * // Invalidate all board queries after creating a new board
 * queryClient.invalidateQueries({ queryKey: boardKeys.all() })
 *
 * // Invalidate only a specific board's todos
 * queryClient.invalidateQueries({ queryKey: boardKeys.todos('abc123') })
 */
export const boardKeys = {
  /** All boards query key — used for the dashboard list */
  all:    ()           => ['boards']               as const,
  /** Single board detail query key — used for the board page header */
  detail: (id: string) => ['boards', id]           as const,
  /** Todos for a specific board query key — used for the Kanban columns */
  todos:  (id: string) => ['boards', id, 'todos']  as const,
  /** Pending invitations for a board query key — used in the InviteForm */
  invitations: (id: string) => ['boards', id, 'invitations'] as const,
  /** Activity feed for a board — used by the board Activity page */
  activity: (id: string) => ['boards', id, 'activity'] as const,
  /** Comment feed for a single todo — used by the Todo side panel */
  comments: (boardId: string, todoId: string) =>
    ['boards', boardId, 'todos', todoId, 'comments'] as const,
}

/**
 * Query Key Factory for the acting user's Notification dropdown.
 *
 * Self-scoped by design — there is no per-board or per-user argument because
 * GET /api/notifications only ever returns the signed-in user's rows.
 * Invalidating `notificationKeys.all()` invalidates the whole bell surface
 * (badge + list), which is what every Notification mutation needs.
 */
export const notificationKeys = {
  /** The bell's single feed query (page + unread count) */
  all: () => ['notifications'] as const,
}

/**
 * Query Options for fetching all boards (Dashboard)
 *
 * WHAT IT DOES:
 * - Fetches GET /api/boards (returns boards where user is owner or member)
 * - Caches the result for 30 seconds (staleTime)
 * - Keeps unused data in cache for 5 minutes (gcTime)
 *
 * CONFIGURATION:
 * - staleTime: 30_000ms (30 seconds)
 *   After 30 seconds, the data is considered "stale" and will refetch on next use.
 *   Boards change infrequently (users don't rename them every second), so 30s is safe.
 *
 * - gcTime: 300_000ms (5 minutes)
 *   How long to keep unused data in memory. After 5 minutes without use, data is garbage collected.
 *   This prevents memory leaks while keeping data available for quick navigation.
 *
 * USAGE:
 * - Client: useQuery(boardsQueryOptions()) in DashboardClient
 *
 * @example
 * // In a Client Component:
 * const { data } = useQuery(boardsQueryOptions())
 */
export const boardsQueryOptions = () =>
  queryOptions({
    queryKey:  boardKeys.all(),
    queryFn:   () => fetchJson<Board[]>('/api/boards'),
    staleTime: 30_000, // 30 seconds — boards don't change frequently
    gcTime:    300_000, // 5 minutes — keep in cache for quick navigation
  })

/**
 * Query Options for fetching a single board's detail (members + tags)
 *
 * WHAT IT DOES:
 * - Fetches GET /api/boards/[id] (board with members, tags, owner)
 * - Caches the result for 30 seconds (staleTime)
 * - Keeps unused data in cache for 5 minutes (gcTime)
 *
 * USAGE:
 * - Client: useQuery(boardDetailQueryOptions(boardId))
 * - Server: prefetchQuery(boardDetailQueryOptions(boardId))
 *
 * @example
 * const { data } = useQuery(boardDetailQueryOptions('abc123'))
 */
export const boardDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey:  boardKeys.detail(id),
    queryFn:   () => fetchJson<BoardDetail>(`/api/boards/${id}`),
    staleTime: 30_000,
    gcTime:    300_000,
  })

/**
 * Query Options for fetching pending invitations for a board
 *
 * WHAT IT DOES:
 * - Fetches GET /api/invitations?boardId=[id] (pending invitations)
 * - Caches the result for 10 seconds (shorter than board detail)
 * - Only used by the board owner on the settings/invite page
 *
 * CONFIGURATION:
 * - staleTime: 10_000ms (10 seconds)
 *   Invitations change when someone invites or revokes, which is less frequent.
 *   But when it does change, we want to see it quickly.
 *
 * USAGE:
 * - Client: useQuery(invitationsQueryOptions(boardId))
 *
 * @example
 * const { data } = useQuery(invitationsQueryOptions('abc123'))
 */
export const invitationsQueryOptions = (id: string) =>
  queryOptions({
    queryKey:  boardKeys.invitations(id),
    queryFn:   () =>
      fetchJson<{ id: string; email: string; expiresAt: string }[]>(
        `/api/invitations?boardId=${id}`
      ),
    staleTime: 10_000,
    gcTime:    300_000,
  })

/**
 * Query Options for fetching todos for a board (Kanban)
 *
 * WHAT IT DOES:
 * - Fetches GET /api/boards/[id]/todos (todos with assignee and tags)
 * - Polls every 8 seconds for near-real-time teammate sync
 * - staleTime: 0 ensures every poll fetches fresh data
 *
 * CONFIGURATION:
 * - staleTime: 0ms
 *   Always considered stale so polling always fetches fresh data.
 *   This is critical for real-time collaboration — teammates' changes
 *   must appear within 8 seconds.
 *
 * - refetchInterval: 8_000ms (8 seconds)
 *   Polls the server every 8 seconds to sync with other users.
 *   This is the "near-real-time" mechanism at MVP (no WebSockets).
 *
 * - retry: 3
 *   If a poll fails (network blip, server error), retry up to 3 times
 *   before giving up. TanStack Query uses exponential backoff.
 *
 * USAGE:
 * - Client: useQuery(todosQueryOptions(boardId))
 * - Server: prefetchQuery(todosQueryOptions(boardId))
 *
 * @example
 * const { data } = useQuery(todosQueryOptions('abc123'))
 */
export const todosQueryOptions = (id: string) =>
  queryOptions({
    queryKey:        boardKeys.todos(id),
    queryFn:         () => fetchJson<TodoWithRelations[]>(`/api/boards/${id}/todos`),
    staleTime:       0,
    gcTime:          300_000,
    refetchInterval: 8_000,
    retry:           3,
  })

/**
 * Infinite query options for a Todo's Comment feed (20 per page, oldest → newest)
 *
 * WHAT IT DOES:
 * - First page: GET /api/todos/[id]/comments → the newest 20 comments,
 *   returned oldest → newest within the page
 * - "Load older": GET /api/todos/[id]/comments?before=<nextCursor> → the
 *   previous 20 comments (never a full-list fetch — spec "Pagination rule")
 * - nextCursor === null means the start of the feed is reached
 *
 * CONFIGURATION:
 * - staleTime: 0 — the feed is revalidated by the two-cache invalidation rule
 *   after every comment mutation (server revalidateTag + client invalidate)
 * - No polling: unlike todos, comment feeds are mutation-driven
 *
 * USAGE:
 * - Client: useInfiniteQuery(commentFeedQueryOptions(boardId, todoId))
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } =
 *   useInfiniteQuery(commentFeedQueryOptions('board1', 'todo1'))
 */
export const commentFeedQueryOptions = (boardId: string, todoId: string) =>
  infiniteQueryOptions({
    queryKey:        boardKeys.comments(boardId, todoId),
    queryFn:         ({ pageParam }) =>
      fetchJson<CommentFeedPage>(
        `/api/todos/${todoId}/comments${
          pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''
        }`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: CommentFeedPage) => lastPage.nextCursor,
    staleTime:        0,
    gcTime:           300_000,
    retry:            3,
  })

/**
 * Infinite query options for a board's Activity feed (20 per page, newest → oldest)
 *
 * WHAT IT DOES:
 * - First page: GET /api/boards/[id]/activity → the newest 20 entries,
 *   returned newest → oldest (the feed's display order)
 * - "Load older": GET /api/boards/[id]/activity?before=<nextCursor> → the
 *   previous 20 entries (never a full-list fetch — spec "Pagination rule")
 * - nextCursor === null means the start of the log is reached
 *
 * CONFIGURATION:
 * - staleTime: 0 — every mount refetches the first page, so catching up after
 *   other work never shows a stale log
 * - No polling: unlike todos, the feed is mutation-driven
 *
 * USAGE:
 * - Client: useInfiniteQuery(activityFeedQueryOptions(boardId))
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } =
 *   useInfiniteQuery(activityFeedQueryOptions('board1'))
 */
export const activityFeedQueryOptions = (boardId: string) =>
  infiniteQueryOptions({
    queryKey:        boardKeys.activity(boardId),
    queryFn:         ({ pageParam }) =>
      fetchJson<ActivityFeedPage>(
        `/api/boards/${boardId}/activity${
          pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''
        }`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: ActivityFeedPage) => lastPage.nextCursor,
    staleTime:        0,
    gcTime:           300_000,
    retry:            3,
  })

/**
 * Infinite query options for the Notification dropdown (20 per page,
 * newest → oldest)
 *
 * WHAT IT DOES:
 * - First page: GET /api/notifications → the newest 20 Notifications plus
 *   the badge value (`unreadCount`)
 * - "Load more": GET /api/notifications?before=<nextCursor> → the previous
 *   20 rows (never a full-list fetch — spec "Pagination rule")
 * - nextCursor === null means the start of the list is reached
 *
 * CONFIGURATION:
 * - refetchInterval: 8_000ms — the same poll cadence as todos, so a
 *   teammate's assignment appears without a manual refresh (spec req 41)
 * - staleTime: 0 — the feed and badge are revalidated by the two-cache
 *   invalidation rule after every Notification mutation
 *
 * USAGE:
 * - Client: useInfiniteQuery(notificationsQueryOptions())
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(notificationsQueryOptions())
 */
export const notificationsQueryOptions = () =>
  infiniteQueryOptions({
    queryKey:        notificationKeys.all(),
    queryFn:         ({ pageParam }) =>
      fetchJson<NotificationFeedPage>(
        `/api/notifications${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: NotificationFeedPage) => lastPage.nextCursor,
    staleTime:        0,
    gcTime:           300_000,
    refetchInterval:  8_000,
    retry:            3,
  })
