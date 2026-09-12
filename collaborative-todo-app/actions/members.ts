// Managing WHO is on a list: owners can remove any member, and members can
// remove themselves ("leave"). Note the owner can never "leave" their own
// list via this action — see TDD §11 trade-off: single-owner model means
// there's no concept of an owner stepping down without transferring or
// deleting the list (ownership transfer is explicitly post-MVP).

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { updateTag } from 'next/cache'

/** Removes another user from a list. Owner-only. */
export async function removeMember(listId: string, userId: string) {
  const session = await getRequiredSession()

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } })

  if (list.ownerId !== session.user.id) {
    throw new Error('Forbidden: only the list owner can remove members')
  }

  // Deleting the ListMember row is enough — any Todos this user had
  // assigned to them are handled separately by the `onDelete: SetNull`
  // relation on Todo.assignee, so they simply become "Unassigned," they
  // are NOT deleted.
  await prisma.listMember.deleteMany({ where: { listId, userId } })

  updateTag('list-detail')
  return { success: true }
}

/**
 * Lets a MEMBER (not the owner) remove themselves from a list.
 * The owner cannot call this on themselves — see the check below.
 */
export async function leaveList(listId: string) {
  const session = await getRequiredSession()

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } })

  if (list.ownerId === session.user.id) {
    throw new Error(
      'Owners cannot leave their own list — delete the list instead, or transfer ownership (not yet supported).'
    )
  }

  await prisma.listMember.deleteMany({
    where: { listId, userId: session.user.id },
  })

  updateTag('list-detail')
  updateTag('lists') // this list disappears from "Lists I'm a Member of"
  return { success: true }
}