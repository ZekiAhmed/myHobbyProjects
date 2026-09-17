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
 * - boardKeys.all()             → ['boards']                         (list of all boards)
 * - boardKeys.detail(id)        → ['boards', boardId]                (single board details)
 * - boardKeys.todos(id)         → ['boards', boardId, 'todos']       (todos for a board)
 * - boardKeys.invitations(id)   → ['boards', boardId, 'invitations'] (pending invitations)
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
    queryFn:   () => fetch('/api/boards').then(r => r.json()),
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
    queryFn:   () => fetch(`/api/boards/${id}`).then(r => r.json()),
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
    queryFn:   () => fetch(`/api/invitations?boardId=${id}`).then(r => r.json()),
    staleTime: 10_000,
    gcTime:    300_000,
  })
