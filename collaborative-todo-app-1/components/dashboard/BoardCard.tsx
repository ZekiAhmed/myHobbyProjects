'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
