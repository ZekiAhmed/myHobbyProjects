// The actual dashboard UI. Splits lists into "Lists I Own" and "Lists I'm
// a Member of" (PRD Dashboard Flow). Uses useSuspenseQuery — meaning by
// the time this component's body runs, `data` is GUARANTEED to be
// populated (either from the server prefetch above, or from a loading
// Suspense boundary further up the tree while it fetches).

'use client'

import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { listsQueryOptions } from '@/lib/queries/lists'
import { ListCard } from './ListCard'
import { NewListModal } from './NewListModal'
import { Button } from '@/components/ui/button'

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
    <div>
      <header>
        <h1>Your Lists</h1>
        <Button onClick={() => setIsModalOpen(true)}>New List</Button>
      </header>

      <section>
        <h2>Lists I Own</h2>
        {ownedLists.length === 0 && <p>You don't own any lists yet.</p>}
        <div>
          {ownedLists.map((list: ListSummary) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </section>

      <section>
        <h2>Lists I'm a Member of</h2>
        {memberLists.length === 0 && <p>You haven't joined any lists yet.</p>}
        <div>
          {memberLists.map((list: ListSummary) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      </section>

      {isModalOpen && <NewListModal onClose={() => setIsModalOpen(false)} />}
    </div>
  )
}