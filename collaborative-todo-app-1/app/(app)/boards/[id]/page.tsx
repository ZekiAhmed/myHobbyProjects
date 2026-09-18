/**
 * @fileoverview Board Detail Page (Server Component)
 *
 * This is the board detail page (route: /boards/[id]).
 * It displays the Kanban board with todos organized by status.
 *
 * SERVER COMPONENT + PREFETCHING:
 * This is a Server Component that runs on the server during the initial request.
 * It prefetches board detail and todos data, then passes it to the client via HydrationBoundary.
 *
 * WHY PREFETCH?
 * - Board renders immediately with data — no loading skeleton flash
 * - Data arrives with the HTML for fast first paint
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns
 */

import { Suspense } from 'react'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { boardDetailQueryOptions, todosQueryOptions } from '@/lib/queries/board-keys'
import { KanbanBoard } from '@/components/board/KanbanBoard'
import { getRequiredSession } from '@/lib/session'

/**
 * Board Detail Page — Server Component
 *
 * This component runs on the server and prefetches board data.
 * It passes the dehydrated state to the client via HydrationBoundary.
 *
 * @returns The Kanban board UI
 */
export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getRequiredSession()
  const queryClient = new QueryClient()

  // Prefetch both board detail and todos in parallel
  await Promise.all([
    queryClient.prefetchQuery(boardDetailQueryOptions(id)),
    queryClient.prefetchQuery(todosQueryOptions(id)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading board...</div>}>
        <KanbanBoard boardId={id} currentUserId={session.user.id} />
      </Suspense>
    </HydrationBoundary>
  )
}
