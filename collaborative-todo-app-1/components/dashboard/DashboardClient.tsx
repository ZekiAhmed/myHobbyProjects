/**
 * @fileoverview Dashboard Client Component
 *
 * This is a Client Component that renders the dashboard UI.
 * It receives board data as props from the Server Component.
 *
 * WHY A CLIENT COMPONENT?
 * - Can use useState/useEffect for local UI state (modals, filters)
 * - Can use useMutation() for creating/deleting boards
 * - Server Components can't use React hooks or handle user interactions
 *
 * DATA FLOW:
 * 1. Server Component (page.tsx) queries the database directly
 * 2. Server Component passes data as props to this Client Component
 * 3. Client Component renders the UI with the data
 * 4. When the user creates a board, we use useMutation to update the server
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns
 */

'use client' // Marks this as a Client Component (can use hooks, browser APIs)

import { BoardCard } from '@/components/dashboard/BoardCard'
import { NewBoardModal } from '@/components/dashboard/NewBoardModal'
import type { Board } from '@/lib/types'

/**
 * DashboardClient — renders the dashboard UI
 *
 * WHAT IT DOES:
 * 1. Receives board data from the Server Component
 * 2. Separates boards into "owned" and "member" sections
 * 3. Renders a grid of BoardCard components for each section
 * 4. Shows an empty state if the user has no boards
 *
 * @param initialBoards - The boards fetched by the Server Component
 * @returns The dashboard UI with board sections
 */
export function DashboardClient({ initialBoards, currentUserId }: { initialBoards: Board[]; currentUserId: string }) {
  const boards = initialBoards
  
  /**
   * Separate boards into owned and member sections
   *
   * HOW IT WORKS:
   * - ownedBoards: Boards where the current user is the owner
   * - memberBoards: Boards where the current user is a member (not owner)
   */
  const ownedBoards = boards.filter((board) => board.ownerId === currentUserId)
  const memberBoards = boards.filter((board) => board.ownerId !== currentUserId)

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
              {ownedBoards.map((board) => (
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
              {memberBoards.map((board) => (
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
