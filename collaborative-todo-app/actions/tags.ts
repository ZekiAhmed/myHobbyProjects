// Tag management is OWNER-ONLY (per PRD's owner-vs-member table — members
// can ASSIGN existing tags to todos via the edit form, but can't create or
// delete tags themselves). Tags are scoped per-list, so deleting a tag only
// affects that one board.

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { updateTag } from 'next/cache'

/** Creates a new tag on a list. Owner-only. Fails if the name is a duplicate. */
export async function createTag(listId: string, name: string, color: string) {
  const session = await getRequiredSession()

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } })

  if (list.ownerId !== session.user.id) {
    throw new Error('Forbidden: only the list owner can create tags')
  }

  if (!name.trim()) {
    throw new Error('Tag name is required')
  }

  // The @@unique([listId, name]) constraint in schema.prisma will throw a
  // Prisma error (P2002) here if a tag with this name already exists on
  // this list — we let that error propagate; the UI shows a friendly
  // "a tag with that name already exists" message when it catches it.
  const tag = await prisma.tag.create({
    data: { listId, name: name.trim(), color },
  })

  updateTag('list-detail')
  return { success: true, tag }
}

/**
 * Deletes a tag entirely. Thanks to `onDelete: Cascade` on TodoTag, this
 * also removes the tag from every todo it was attached to — those todos
 * are NOT deleted, just untagged.
 */
export async function deleteTag(tagId: string) {
  const session = await getRequiredSession()

  const tag = await prisma.tag.findUniqueOrThrow({
    where: { id: tagId },
    include: { list: true },
  })

  if (tag.list.ownerId !== session.user.id) {
    throw new Error('Forbidden: only the list owner can delete tags')
  }

  await prisma.tag.delete({ where: { id: tagId } })

  updateTag('list-detail')
  updateTag('todos') // todo cards need to stop showing this tag's chip
  return { success: true }
}