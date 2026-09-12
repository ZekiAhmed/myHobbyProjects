// Owner-only page (rendered behind the gear icon — hidden entirely from
// members in the nav, but ALSO re-checked here server-side, since hiding a
// link in the UI is not a security boundary — a member could type the URL
// directly).

import { redirect } from 'next/navigation'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { MemberList } from '@/components/settings/MemberList'
import { InviteForm } from '@/components/settings/InviteForm'
import { TagManager } from '@/components/settings/TagManager'

export default async function ListSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getRequiredSession()

  const list = await prisma.list.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      tags: true,
    },
  })

  if (!list) redirect('/')

  // Real, server-side authorization check — a member who navigates
  // directly to this URL gets bounced back to the board, not just a
  // visually-hidden gear icon.
  if (list.ownerId !== session.user.id) {
    redirect(`/lists/${id}`)
  }

  return (
    <div>
      <h1>{list.name} — Settings</h1>

      <section>
        <h2>Members</h2>
        <MemberList listId={id} members={list.members.map((m) => m.user)} />
        <InviteForm listId={id} />
      </section>

      <section>
        <h2>Tags</h2>
        <TagManager listId={id} tags={list.tags} />
      </section>

      {/* Danger zone (rename/delete) omitted here for brevity — it follows
          the exact same Server Action + confirm-dialog pattern as
          MemberList's "remove" button below. */}
    </div>
  )
}