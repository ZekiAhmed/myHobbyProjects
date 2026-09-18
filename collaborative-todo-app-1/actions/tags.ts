'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'

const CreateTagSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

async function verifyBoardOwnership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  })

  if (!board) return actionError('server', 'Board not found')
  if (board.ownerId !== userId) return actionError('authorization', 'Only the board owner can manage tags')
  return null
}

export async function createTag(input: {
  boardId: string
  name: string
  color: string
}): Promise<ActionResult<{ id: string; name: string; color: string; boardId: string }>> {
  try {
    const session = await getRequiredSession()
    const parsed = CreateTagSchema.safeParse(input)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid tag data')
    }

    const ownershipError = await verifyBoardOwnership(parsed.data.boardId, session.user.id)
    if (ownershipError) return ownershipError

    const tag = await prisma.tag.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        boardId: parsed.data.boardId,
      },
    })

    revalidateTag('board-detail', 'max')

    return actionSuccess(tag)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return actionError('validation', 'A tag with this name already exists')
    }
    return actionError('server', 'Failed to create tag')
  }
}

export async function deleteTag(tagId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const session = await getRequiredSession()

    const existingTag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: { boardId: true },
    })

    if (!existingTag) return actionError('server', 'Tag not found')

    const ownershipError = await verifyBoardOwnership(existingTag.boardId, session.user.id)
    if (ownershipError) return ownershipError

    await prisma.tag.delete({ where: { id: tagId } })

    revalidateTag('board-detail', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to delete tag')
  }
}
