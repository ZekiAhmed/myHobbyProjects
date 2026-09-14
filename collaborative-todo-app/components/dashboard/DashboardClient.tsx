'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { listsQueryOptions } from '@/lib/queries/lists'
import { ListCard } from './ListCard'
import { NewListModal } from './NewListModal'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid } from 'lucide-react'

type ListSummary = {
  id: string
  name: string
  isOwner: boolean
  memberCount: number
  openTodoCount: number
}

export function DashboardClient() {
  const { data: lists } = useSuspenseQuery(listsQueryOptions())
  const [isModalOpen, setIsModalOpen] = useState(false)

  const ownedLists = lists.filter((l: ListSummary) => l.isOwner)
  const memberLists = lists.filter((l: ListSummary) => !l.isOwner)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Lists</h1>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <Plus className="size-4" />
          New List
        </Button>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Lists I Own
        </h2>
        {ownedLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <LayoutGrid className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              You don&apos;t own any lists yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ownedLists.map((list: ListSummary) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Lists I&apos;m a Member of
        </h2>
        {memberLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <LayoutGrid className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              You haven&apos;t joined any lists yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {memberLists.map((list: ListSummary) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>

      {isModalOpen && <NewListModal onClose={() => setIsModalOpen(false)} />}
    </div>
  )
}
