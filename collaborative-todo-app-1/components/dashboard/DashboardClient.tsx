/**
 * @fileoverview Dashboard Client Component
 *
 * This is a Client Component that renders the dashboard UI.
 * It reads board data from the TanStack Query cache (prefetched by the Server Component).
 *
 * WHY A CLIENT COMPONENT?
 * - Uses useSuspenseQuery() for reactive data fetching
 * - Could use useState/useEffect for local UI state (modals, filters)
 * - Could use useMutation() for creating/deleting boards
 * - Server Components can't use React hooks or handle user interactions
 *
 * DATA FLOW:
 * 1. Server Component (page.tsx) prefetches data and passes it via HydrationBoundary
 * 2. This Client Component reads the prefetched data via useSuspenseQuery()
 * 3. If data is stale (older than 30s), it refetches in the background
 * 4. If no data exists (first visit), it shows a loading state until data arrives
 *
 * SUSPENSE INTEGRATION:
 * useSuspenseQuery() integrates with React's Suspense boundary.
 * While data is loading, the nearest <Suspense> fallback is shown.
 * Once data arrives, this component renders with the full board list.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/suspense
 */

'use client' // Marks this as a Client Component (can use hooks, browser APIs)

import { useSuspenseQuery } from '@tanstack/react-query'
import { boardsQueryOptions } from '@/lib/queries/boards'
import { BoardCard } from '@/components/dashboard/BoardCard'
import { NewBoardModal } from '@/components/dashboard/NewBoardModal'

/**
 * Board type definition — matches the shape returned by GET /api/boards
 *
 * This type represents a board with its metadata:
 * - id: Unique identifier (CUID)
 * - name: Display name (e.g., "Sprint 42")
 * - ownerId: ID of the user who owns the board
 * - createdAt/updatedAt: Timestamps
 * - _count: Metadata counts (members and open todos)
 *
 * WHY DEFINE THE TYPE HERE?
 * - TypeScript needs to know the shape of the data
 * - Keeps the component self-contained and type-safe
 * - Could be moved to a shared types/ file if used elsewhere
 */
type Board = {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
  _count: {
    members: number  // Total number of members (excluding owner)
    todos: number    // Number of open (non-DONE) todos
  }
}

/**
 * DashboardClient — renders the dashboard UI
 *
 * WHAT IT DOES:
 * 1. Reads board data from the TanStack Query cache
 * 2. Separates boards into "owned" and "member" sections
 * 3. Renders a grid of BoardCard components for each section
 * 4. Shows an empty state if the user has no boards
 *
 * @returns The dashboard UI with board sections
 */
export function DashboardClient() {
  // Read board data from the TanStack Query cache
  // useSuspenseQuery() will:
  //   - Return cached data if available (from prefetch or previous fetch)
  //   - Fetch data if not cached or stale
  //   - Show Suspense fallback while loading
  //   - Throw an error if the fetch fails (caught by ErrorBoundary)
  const { data: boards } = useSuspenseQuery(boardsQueryOptions())
  
  /**
   * Separate boards into owned and member sections
   *
   * HOW IT WORKS:
   * - ownedBoards: Boards where the current user is the owner
   * - memberBoards: Boards where the current user is a member (not owner)
   *
   * FILTERING LOGIC:
   * We compare each board's ownerId to the first board's ownerId.
   * This is a simplification — ideally, we'd know the current user's ID.
   *
   * IMPORTANT: This logic has a potential bug:
   * If the user's first board isn't theirs (e.g., they're only a member),
   * ALL boards will be misclassified. A better approach would be to pass
   * the current user's ID from the Server Component via props.
   */
  const ownedBoards = boards.filter((board: Board) => board.ownerId === boards[0]?.ownerId)
  const memberBoards = boards.filter((board: Board) => board.ownerId !== boards[0]?.ownerId)

  return (
    <div className="container mx-auto py-8">
      {/* Dashboard header with title and "New Board" button */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <NewBoardModal />
      </div>

      <div className="space-y-8">
        {/* "Boards I Own" section — only shown if user owns any boards */}
        {ownedBoards.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Boards I Own</h2>
            {/* Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedBoards.map((board: Board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          </section>
        )}

        {/* "Boards I'm a Member of" section — only shown if user is a member of any boards */}
        {memberBoards.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Boards I&apos;m a Member of</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {memberBoards.map((board: Board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state — shown when user has no boards */}
        {boards.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">You don&apos;t have any boards yet.</p>
            <NewBoardModal />
          </div>
        )}
      </div>
    </div>
  )
}
