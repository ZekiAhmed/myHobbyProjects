// Same server-prefetch pattern as the dashboard, but prefetching TWO
// queries in parallel (list detail + todos) via Promise.all — this means
// both requests fire at the same time on the server rather than one
// waiting for the other, keeping first paint fast (TDD target: < 300ms).

import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { listDetailQueryOptions } from '@/lib/queries/lists'
import { todosQueryOptions } from '@/lib/queries/todos'
import { getRequiredSession } from '@/lib/session'
import { KanbanBoard } from '@/components/board/KanbanBoard'

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getRequiredSession()

  const queryClient = new QueryClient()

  // Promise.all runs both prefetches concurrently rather than sequentially
  // — cuts the server-side wait roughly in half compared to awaiting them
  // one at a time.
  await Promise.all([
    queryClient.prefetchQuery(listDetailQueryOptions(id)),
    queryClient.prefetchQuery(todosQueryOptions(id)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <KanbanBoard listId={id} />
    </HydrationBoundary>
  )
}