import { notFound, redirect } from 'next/navigation'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { BoardSettingsClient } from '@/components/settings/BoardSettingsClient'

interface SettingsPageProps {
  params: Promise<{ id: string }>
}

export default async function BoardSettingsPage({ params }: SettingsPageProps) {
  const session = await getRequiredSession()
  const { id } = await params

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      tags: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!board) {
    notFound()
  }

  const isOwner = board.ownerId === session.user.id
  if (!isOwner) {
    redirect(`/boards/${id}`)
  }

  return (
    <BoardSettingsClient
      boardId={id}
      boardName={board.name}
      owner={board.owner}
      members={board.members}
      tags={board.tags}
      currentUserId={session.user.id}
    />
  )
}
