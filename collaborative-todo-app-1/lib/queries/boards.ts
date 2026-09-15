/**
 * @fileoverview Board Data Queries
 *
 * This file contains:
 * 1. Query Key Factory — consistent cache keys for board data
 * 2. Prisma Query Functions — shared database queries (used by Server Components and API routes)
 * 3. TanStack Query Options — client-side fetch configuration
 *
 * WHY A SHARED PRISMA QUERY?
 * - Server Components can't forward cookies to internal fetch() calls
 * - So we query the database directly via Prisma instead of fetch('/api/boards')
 * - The shared function ensures both page.tsx and route.ts use the same logic
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/query-options
 */

import { queryOptions } from '@tanstack/react-query'
import { prisma } from '@/lib/db'

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
 * Fetch all boards the current user has access to (owner OR member).
 *
 * WHAT IT DOES:
 * - Queries the database for boards where the user is the owner or a member
 * - Includes member count and open todo count (_count)
 * - Orders by most recently updated first
 *
 * USED BY:
 * - app/(app)/page.tsx (Server Component — passes data as props)
 * - app/api/boards/route.ts (API Route — returns JSON)
 *
 * WHY SHARED?
 * Both the Server Component and the API Route need the same query.
 * Extracting it here prevents the two copies from drifting apart.
 *
 * @returns Array of boards with _count metadata
 */
export async function fetchBoards(userId: string) {
  return prisma.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          members: true,
          todos: {
            where: {
              status: {
                not: 'DONE',
              },
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
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
