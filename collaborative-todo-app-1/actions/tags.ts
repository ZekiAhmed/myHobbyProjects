'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import { activityData, getBestEffortIp } from '@/lib/activity'
import { verifyBoardOwnership } from '@/lib/board-access'

const CreateTagSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

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

    const ipAddress = await getBestEffortIp()

    const tag = await prisma.$transaction(async (tx) => {
      const created = await tx.tag.create({
        data: {
          name: parsed.data.name,
          color: parsed.data.color,
          boardId: parsed.data.boardId,
        },
      })

      await tx.activity.create({
        data: activityData({
          boardId: parsed.data.boardId,
          actorId: session.user.id,
          action: 'tag.created',
          resourceType: 'TAG',
          resourceId: created.id,
          ipAddress,
        }),
      })

      return created
    })

    revalidateTag('board-detail', 'max')
    revalidateTag('activity', 'max')

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

    const ipAddress = await getBestEffortIp()

    await prisma.$transaction(async (tx) => {
      await tx.tag.delete({ where: { id: tagId } })

      await tx.activity.create({
        data: activityData({
          boardId: existingTag.boardId,
          actorId: session.user.id,
          action: 'tag.deleted',
          // The Tag row is gone — its id is the record of which tag went.
          resourceType: 'TAG',
          resourceId: tagId,
          ipAddress,
        }),
      })
    })

    revalidateTag('board-detail', 'max')
    revalidateTag('activity', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to delete tag')
  }
}
