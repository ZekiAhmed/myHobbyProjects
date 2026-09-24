'use server'

import { revalidateTag } from 'next/cache'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import type { CommentWithAuthor } from '@/lib/types'

const CreateCommentSchema = z.object({
  todoId: z.string().min(1),
  body: z.string().refine((value) => value.trim().length > 0, {
    message: 'Comment body cannot be empty',
  }),
})

async function verifyBoardMembership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  })

  if (!board) return actionError('server', 'Board not found')

  const isOwner = board.ownerId === userId
  if (!isOwner) {
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId },
    })
    if (!membership) return actionError('authorization', 'You are not a member of this board')
  }

  return { isOwner, error: null }
}

async function getBestEffortIp(): Promise<string | null> {
  try {
    const requestHeaders = await headers()
    return (
      requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      requestHeaders.get('x-real-ip') ||
      null
    )
  } catch {
    return null
  }
}

export async function createComment(input: {
  todoId: string
  body: string
}): Promise<ActionResult<CommentWithAuthor>> {
  try {
    const session = await getRequiredSession()
    const parsed = CreateCommentSchema.safeParse(input)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid comment')
    }

    const existingTodo = await prisma.todo.findUnique({
      where: { id: parsed.data.todoId },
      select: { boardId: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const ipAddress = await getBestEffortIp()

    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          body: parsed.data.body,
          todoId: parsed.data.todoId,
          authorId: session.user.id,
        },
        include: { author: { select: { id: true, name: true, image: true } } },
      })

      await tx.activity.create({
        data: {
          boardId: existingTodo.boardId,
          actorId: session.user.id,
          action: 'comment.created',
          resourceType: 'COMMENT',
          resourceId: created.id,
          ipAddress,
        },
      })

      return created
    })

    revalidateTag('comments', 'max')

    return actionSuccess(comment)
  } catch {
    return actionError('server', 'Failed to create comment')
  }
}
