// Shows current members and lets the owner remove any of them.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { removeMember } from '@/actions/members'
import { Button } from '@/components/ui/button'

type Member = { id: string; name: string; email: string }

export function MemberList({ listId, members }: { listId: string; members: Member[] }) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(userId: string) {
    // A simple browser confirm — good enough for a destructive-but-
    // recoverable action (the user can just be re-invited).
    if (!confirm('Remove this member from the list?')) return

    setRemovingId(userId)
    try {
      await removeMember(listId, userId)
      // Server Component data (this page) needs a manual refresh signal —
      // router.refresh() re-runs the Server Component without a full page
      // reload, picking up the now-revalidated 'list-detail' tag.
      router.refresh()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <ul>
      {members.map((member) => (
        <li key={member.id}>
          {member.name} ({member.email})
          <Button
            variant="destructive"
            onClick={() => handleRemove(member.id)}
            disabled={removingId === member.id}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  )
}