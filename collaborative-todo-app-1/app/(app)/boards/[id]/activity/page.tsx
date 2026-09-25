/**
 * @fileoverview Board Activity Page (Server Component)
 *
 * Route: /boards/[id]/activity — the dedicated, first-class navigation target
 * for a board's Activity log (spec §Activity log, user story 21).
 *
 * AUTHORIZATION:
 * Same membership gate as board detail: owner OR member, otherwise notFound()
 * (identical denial to the API's 403 — a stranger must not receive a 200 page,
 * and must not be able to enumerate a board's Activity log from the route alone).
 *
 * The feed itself is fetched client-side with infinite pagination (20 per
 * page) — never a full-list read.
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { PageShell } from '@/components/PageShell'
import { ActivityFeed } from '@/components/board/ActivityFeed'

interface ActivityPageProps {
  params: Promise<{ id: string }>
}

export default async function BoardActivityPage({ params }: ActivityPageProps) {
  const { id } = await params
  const session = await getRequiredSession()

  const board = await prisma.board.findUnique({
    where: { id },
    select: {
      ownerId: true,
      members: { select: { userId: true } },
    },
  })
  if (!board) {
    notFound()
  }

  const isOwner = board.ownerId === session.user.id
  const isMember = board.members.some((m) => m.userId === session.user.id)
  if (!isOwner && !isMember) {
    notFound()
  }

  return (
    <PageShell
      title="Activity"
      leading={
        <Link
          href={`/boards/${id}`}
          className="-ml-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to board"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
    >
      <ActivityFeed boardId={id} />
    </PageShell>
  )
}
