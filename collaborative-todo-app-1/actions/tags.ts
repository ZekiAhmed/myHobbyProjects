'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { z } from 'zod/v4'

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

  if (!board) throw new Error('Board not found')
  if (board.ownerId !== userId) throw new Error('Forbidden')
}

export async function createTag(input: {
  boardId: string
  name: string
  color: string
}) {
  const session = await getRequiredSession()
  const parsed = CreateTagSchema.parse(input)

  await verifyBoardOwnership(parsed.boardId, session.user.id)

  const tag = await prisma.tag.create({
    data: {
      name: parsed.name,
      color: parsed.color,
      boardId: parsed.boardId,
    },
  })

  revalidateTag('board-detail', 'max')

  return tag
}

export async function deleteTag(tagId: string) {
  const session = await getRequiredSession()

  const existingTag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { boardId: true },
  })

  if (!existingTag) throw new Error('Tag not found')

  await verifyBoardOwnership(existingTag.boardId, session.user.id)

  await prisma.tag.delete({ where: { id: tagId } })

  revalidateTag('board-detail', 'max')

  return { success: true }
}
