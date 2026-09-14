'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { boardsQueryOptions } from '@/lib/queries/boards'
import { BoardCard } from '@/components/dashboard/BoardCard'
import { NewBoardModal } from '@/components/dashboard/NewBoardModal'

type Board = {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
  _count: {
    members: number
    todos: number
  }
}

export function DashboardClient() {
  const { data: boards } = useSuspenseQuery(boardsQueryOptions())
  
  const ownedBoards = boards.filter((board: Board) => board.ownerId === boards[0]?.ownerId)
  const memberBoards = boards.filter((board: Board) => board.ownerId !== boards[0]?.ownerId)

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <NewBoardModal />
      </div>

      <div className="space-y-8">
        {ownedBoards.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">Boards I Own</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedBoards.map((board: Board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          </section>
        )}

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
