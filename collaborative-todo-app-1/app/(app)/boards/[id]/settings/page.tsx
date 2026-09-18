import { notFound, redirect } from 'next/navigation'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { TagManager } from '@/components/settings/TagManager'
import { MemberList } from '@/components/settings/MemberList'

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
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Board Settings</h1>

      <div className="space-y-8">
        {/* Tag Management */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <TagManager boardId={id} tags={board.tags} />
        </section>

        {/* Member Management */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <MemberList
            boardId={id}
            currentUserId={session.user.id}
            isOwner={isOwner}
            members={board.members}
            owner={board.owner}
          />
        </section>
      </div>
    </div>
  )
}
