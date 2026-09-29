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
import { notFound } from 'next/navigation'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { boardDetailQueryOptions, todosQueryOptions } from '@/lib/queries/board-keys'
import { KanbanBoard } from '@/components/board/KanbanBoard'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { deriveBoardWriteLock } from '@/lib/subscription'

/**
 * Board Detail Page — Server Component
 *
 * WHAT IT DOES:
 * 1. Authenticates (redirects to sign-in if no session)
 * 2. Authorizes — owner OR member, same rule as GET /api/boards/[id]
 *    (without this, a stranger got a 200 shell while APIs returned 403)
 * 3. Derives the entitlement lock (subscription-billing issue 09): a
 *    Board with Members whose Owner's period has ended is read-only —
 *    rendered viewable, but with every write affordance withdrawn
 * 4. Prefetches board detail + todos into the React Query cache
 * 5. Renders KanbanBoard
 *
 * @returns The Kanban board UI
 */
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ todo?: string | string[] }>
}) {
  const { id } = await params
  const sp = await searchParams
  const focusTodoId = Array.isArray(sp?.todo) ? sp.todo[0] : sp?.todo
  const session = await getRequiredSession()

  // Authorize — match API owner-or-member rule (hypothesis #1 fix)
  const board = await prisma.board.findUnique({
    where: { id },
    select: {
      ownerId: true,
      members: { select: { userId: true } },
      owner: { select: { subscriptionPeriodEnd: true } },
    },
  })
  if (!board) {
    notFound()
  }
  const isOwner = board.ownerId === session.user.id
  const isMember = board.members.some((m) => m.userId === session.user.id)
  if (!isOwner && !isMember) {
    // Same denial as API 403 — do not render the board shell
    notFound()
  }

  // Entitlement (issue 09): derived at read time — no cron, no flag to
  // clear. The owner relation and the member list are already loaded
  // for authorization, so the lock costs no extra query.
  const writeLock = deriveBoardWriteLock({
    hasMembers: board.members.length > 0,
    ownerPeriodEnd: board.owner?.subscriptionPeriodEnd ?? null,
    now: new Date(),
  })

  const queryClient = new QueryClient()

  // Prefetch both board detail and todos in parallel
  await Promise.all([
    queryClient.prefetchQuery(boardDetailQueryOptions(id)),
    queryClient.prefetchQuery(todosQueryOptions(id)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading board...</div>}>
        <KanbanBoard
          boardId={id}
          currentUserId={session.user.id}
          focusTodoId={focusTodoId ?? null}
          writeLock={writeLock}
        />
      </Suspense>
    </HydrationBoundary>
  )
}
