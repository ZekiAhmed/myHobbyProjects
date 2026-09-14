/**
 * @fileoverview TanStack Query Options for Board Data
 *
 * This file defines the query keys and query options for all board-related data fetching.
 * TanStack Query (formerly React Query) manages server state caching, refetching, and
 * background updates. This file is the "source of truth" for how board data is fetched.
 *
 * WHY SEPARATE QUERY OPTIONS?
 * - Reusability: Same query options used in prefetching (server) and useQuery (client)
 * - Consistency: All components fetch the same data with the same configuration
 * - Testability: Query options can be tested independently
 * - Maintainability: Change fetch logic in one place, affects all consumers
 *
 * TWO-CACHE SYSTEM:
 * This app uses a two-cache system (see TRD section 2):
 *   1. Next.js fetch cache (server-side, CDN) — invalidated via revalidateTag()
 *   2. TanStack Query client cache (browser) — invalidated via queryClient.invalidateQueries()
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-options
 */

import { queryOptions } from '@tanstack/react-query'

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
 * - boardKeys.all()           → ['boards']                    (list of all boards)
 * - boardKeys.detail(id)      → ['boards', boardId]           (single board details)
 * - boardKeys.todos(id)       → ['boards', boardId, 'todos']  (todos for a board)
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
 * - Server: prefetchQuery(boardsQueryOptions()) in Dashboard page
 * - Client: useSuspenseQuery(boardsQueryOptions()) in DashboardClient
 *
 * @example
 * // In a Server Component (prefetching):
 * const queryClient = new QueryClient()
 * await queryClient.prefetchQuery(boardsQueryOptions())
 *
 * // In a Client Component (reading):
 * const { data } = useSuspenseQuery(boardsQueryOptions())
 */
export const boardsQueryOptions = () =>
  queryOptions({
    queryKey:  boardKeys.all(),
    queryFn:   () => fetch('/api/boards').then(r => r.json()),
    staleTime: 30_000, // 30 seconds — boards don't change frequently
    gcTime:    300_000, // 5 minutes — keep in cache for quick navigation
  })

/**
 * Query Options for fetching a single board's details
 *
 * WHAT IT DOES:
 * - Fetches GET /api/boards/[id] (returns board with members and tags)
 * - Caches the result for 30 seconds
 * - Keeps unused data in cache for 5 minutes
 *
 * NOTE: This endpoint doesn't exist yet (will be implemented in issue 03).
 * The query options are pre-defined here for consistency and future use.
 *
 * @param id - The board's unique identifier (CUID)
 *
 * @example
 * const { data } = useSuspenseQuery(boardDetailQueryOptions('clx1234567890'))
 */
export const boardDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey:  boardKeys.detail(id),
    queryFn:   () => fetch(`/api/boards/${id}`).then(r => r.json()),
    staleTime: 30_000,
    gcTime:    300_000,
  })

/**
 * Query Options for fetching todos for a specific board
 *
 * WHAT IT DOES:
 * - Fetches GET /api/boards/[id]/todos (returns all todos for the board)
 * - Polls every 8 seconds for near-real-time sync
 * - Retries up to 3 times on failure
 *
 * CONFIGURATION:
 * - staleTime: 0 (ALWAYS stale)
 *   Every time the query is used, it refetches immediately.
 *   This is intentional — todos change frequently (users drag-and-drop, complete, edit).
 *   Combined with refetchInterval, this ensures fresh data every 8 seconds.
 *
 * - refetchInterval: 8_000ms (8 seconds)
 *   The polling interval for near-real-time teammate sync.
 *   Every 8 seconds, the client fetches fresh todo data from the server.
 *   This is the core mechanism for collaboration (see PRD section 4, feature 21).
 *
 * - retry: 3
 *   If a poll fails, retry up to 3 times with exponential backoff.
 *   This handles temporary network issues without breaking the UX.
 *
 * TRADE-OFF:
 * Polling every 8 seconds creates ~125 DB reads/second at medium scale (1000 concurrent users).
 * This is manageable with Prisma Accelerate's edge caching (see TRD section 9).
 * WebSocket would be more efficient but adds complexity — polling is the MVP choice.
 *
 * @param id - The board's unique identifier (CUID)
 *
 * @example
 * const { data: todos } = useSuspenseQuery(todosQueryOptions('clx1234567890'))
 */
export const todosQueryOptions = (id: string) =>
  queryOptions({
    queryKey:        boardKeys.todos(id),
    queryFn:         () => fetch(`/api/boards/${id}/todos`).then(r => r.json()),
    staleTime:       0,         // Always stale — refetch on every use
    gcTime:          300_000,   // Keep in cache for 5 minutes
    refetchInterval: 8_000,     // Poll every 8 seconds for near-real-time sync
    retry:           3,         // Retry up to 3 times on failure
  })
