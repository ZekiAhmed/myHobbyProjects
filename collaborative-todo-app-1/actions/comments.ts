'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import { activityData, getBestEffortIp } from '@/lib/activity'
import type { CommentWithAuthor } from '@/lib/types'

/** Plain-text body rule shared by create and edit: non-blank, no length cap. */
const CommentBodySchema = z.string().refine((value) => value.trim().length > 0, {
  message: 'Comment body cannot be empty',
})

const CreateCommentSchema = z.object({
  todoId: z.string().min(1),
  body: CommentBodySchema,
})

const UpdateCommentSchema = z.object({
  commentId: z.string().min(1),
  body: CommentBodySchema,
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
        data: activityData({
          boardId: existingTodo.boardId,
          actorId: session.user.id,
          action: 'comment.created',
          resourceType: 'COMMENT',
          resourceId: created.id,
          ipAddress,
        }),
      })

      return created
    })

    revalidateTag('comments', 'max')
    revalidateTag('activity', 'max')

    return actionSuccess(comment)
  } catch {
    return actionError('server', 'Failed to create comment')
  }
}

type CommentModerationContext = {
  comment: { id: string; authorId: string; todo: { id: string; boardId: string } }
  isOwner: boolean
}

/**
 * Load one Comment's moderation context — its author, its Todo and board,
 * and whether the caller is the board Owner — or an authorization/server
 * error result.
 *
 * Shared by the edit/delete entrypoints so both resolve the membership
 * check against the same shape before applying their own role rule
 * (edit: author only; delete: author or Owner).
 */
async function findCommentForModeration(
  commentId: string,
  userId: string
): Promise<ActionResult<CommentModerationContext>> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, todo: { select: { id: true, boardId: true } } },
  })

  if (!comment) return actionError('server', 'Comment not found')

  const membershipResult = await verifyBoardMembership(comment.todo.boardId, userId)
  if (membershipResult.error) return membershipResult

  return actionSuccess({ comment, isOwner: membershipResult.isOwner })
}

/**
 * Edit a Comment's body — author only.
 *
 * The board Owner's delete-any power deliberately does NOT extend here:
 * Owner ≠ co-author (ADR-0001 / PRD §4.1), so an Owner editing someone
 * else's body is rejected at the server entrypoint.
 *
 * No Activity row is written: comment edits are outside the ADR-0002
 * taxonomy (field-level noise). The feed shows the new body and the
 * `updatedAt` timestamp instead.
 */
export async function updateComment(input: {
  commentId: string
  body: string
}): Promise<ActionResult<CommentWithAuthor>> {
  try {
    const session = await getRequiredSession()
    const parsed = UpdateCommentSchema.safeParse(input)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid comment')
    }

    const lookup = await findCommentForModeration(parsed.data.commentId, session.user.id)
    if (!lookup.success) return lookup

    if (lookup.data.comment.authorId !== session.user.id) {
      return actionError('authorization', 'You can only edit your own comments')
    }

    const comment = await prisma.comment.update({
      where: { id: parsed.data.commentId },
      data: { body: parsed.data.body },
      include: { author: { select: { id: true, name: true, image: true } } },
    })

    revalidateTag('comments', 'max')

    return actionSuccess(comment)
  } catch {
    return actionError('server', 'Failed to update comment')
  }
}

/**
 * Hard-delete a Comment — author or board Owner (ADR-0001).
 *
 * The row is removed outright (no `deletedAt`/tombstone), and the removal
 * is recorded atomically as an Activity entry: who, when, which todo —
 * never the body, which is gone for good.
 */
export async function deleteComment(commentId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const session = await getRequiredSession()

    const lookup = await findCommentForModeration(commentId, session.user.id)
    if (!lookup.success) return lookup
    const { comment, isOwner } = lookup.data

    if (comment.authorId !== session.user.id && !isOwner) {
      return actionError(
        'authorization',
        'Only the comment author or the board owner can delete this comment'
      )
    }

    const ipAddress = await getBestEffortIp()

    await prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } })

      await tx.activity.create({
        data: activityData({
          boardId: comment.todo.boardId,
          actorId: session.user.id,
          action: 'comment.deleted',
          // ADR-0001 requires the entry to record *which todo* the removal
          // happened on. The Comment row is gone by design, so its id would
          // dangle — the resource is the Todo, which outlives the Comment.
          resourceType: 'TODO',
          resourceId: comment.todo.id,
          ipAddress,
        }),
      })
    })

    revalidateTag('comments', 'max')
    revalidateTag('activity', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to delete comment')
  }
}
