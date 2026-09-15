/**
 * @fileoverview Board Card Component
 *
 * This component renders a single board card on the dashboard.
 * Each card displays the board's name, member count, and open todo count.
 *
 * INTERACTION:
 * - The entire card is clickable (wrapped in a Link)
 * - Clicking navigates to the board page (/boards/[id])
 * - Hover effect provides visual feedback
 *
 * DESIGN PATTERN:
 * This is a "presentational" component — it only receives data via props and renders UI.
 * It doesn't fetch data, manage state, or handle mutations.
 * This makes it easy to test, reuse, and reason about.
 *
 * ACCESSIBILITY:
 * - The Link component provides keyboard navigation (Tab + Enter)
 * - The Card has a cursor pointer to indicate clickability
 * - Screen readers can announce the board name and metadata
 *
 * @see https://nextjs.org/docs/app/api-reference/components/link
 */

'use client' // Client Component — uses Next.js Link for client-side navigation

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Board type definition — matches the shape returned by GET /api/boards
 *
 * This is the same type as in DashboardClient.tsx.
 * In a larger app, this would be in a shared types/ file to avoid duplication.
 */
type Board = {
  id: string
  name: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
  _count: {
    members: number  // Total number of members (excluding owner)
    todos: number    // Number of open (non-DONE) todos
  }
}

/**
 * BoardCard — renders a single board card
 *
 * WHAT IT DOES:
 * - Renders a clickable card with the board's name
 * - Shows member count and open todo count
 * - Links to the board page (/boards/[id])
 *
 * @param board - The board object to display
 * @returns A clickable card component
 *
 * @example
 * <BoardCard board={{ id: "abc123", name: "Sprint 42", ... }} />
 */
export function BoardCard({ board }: { board: Board }) {
  return (
    <Link href={`/boards/${board.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{board.name}</CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{board._count.members} members</span>
            <span>{board._count.todos} open todos</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
