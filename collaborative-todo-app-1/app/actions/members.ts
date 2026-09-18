/**
 * @fileoverview Member Management Server Actions
 *
 * This file contains Server Actions for managing board members:
 * - removeMember: Remove a member from a board (owner only)
 * - leaveBoard: Leave a board you're a member of (not the owner)
 *
 * AUTHORIZATION:
 * - removeMember: Only the board owner can remove members
 * - leaveBoard: Only non-owners can leave (the owner cannot "leave" — they must delete the board)
 *
 * CASCADE BEHAVIOR:
 * When a member is removed:
 * - Their BoardMember record is deleted
 * - Todos assigned to them remain but become unassigned (onDelete: SetNull)
 * - This is the PRD's recommendation: "SetNull (unassign)"
 *
 * @see prisma/schema.prisma — BoardMember model, Todo.assignee
 */

'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'

/**
 * Removes a member from a board. Only the board owner can do this.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the current user
 * 2. Verifies the user is the board owner
 * 3. Deletes the BoardMember record
 * 4. Todos assigned to the removed member become unassigned (SetNull)
 * 5. Invalidates the board-detail cache
 *
 * @param boardId - The board to remove the member from
 * @param userId - The ID of the member to remove
 *
 * @example
 * const result = await removeMember("board_abc", "user_xyz")
 * // Member removed, their todos are now unassigned
 */
export async function removeMember(boardId: string, userId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const session = await getRequiredSession()

    const board = await prisma.board.findUniqueOrThrow({
      where: { id: boardId },
    })

    if (board.ownerId !== session.user.id) {
      return actionError('authorization', 'Only the board owner can remove members')
    }

    if (board.ownerId === userId) {
      return actionError('validation', 'Cannot remove the board owner')
    }

    const member = await prisma.boardMember.findFirst({
      where: { boardId, userId },
    })

    if (!member) {
      return actionError('validation', 'User is not a member of this board')
    }

    await prisma.boardMember.delete({
      where: { id: member.id },
    })

    revalidateTag('board-detail', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to remove member')
  }
}

/**
 * Leave a board you're a member of. The board owner cannot use this action.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the current user
 * 2. Checks the user is not the board owner (owner cannot leave)
 * 3. Deletes the user's own BoardMember record
 * 4. Invalidates both 'boards' and 'board-detail' cache tags
 *
 * WHY CANNOT OWNER LEAVE?
 * - The owner is not a BoardMember — they're linked via Board.ownerId
 * - If the owner "leaves", the board would have no owner
 * - The owner must delete the board instead (see deleteBoard action)
 *
 * @param boardId - The board to leave
 *
 * @example
 * const result = await leaveBoard("board_abc")
 * // User is no longer a member of this board
 * // Dashboard will no longer show this board
 */
export async function leaveBoard(boardId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const session = await getRequiredSession()

    const board = await prisma.board.findUniqueOrThrow({
      where: { id: boardId },
    })

    if (board.ownerId === session.user.id) {
      return actionError('authorization', 'Board owners cannot leave their own board. Delete it instead.')
    }

    const member = await prisma.boardMember.findFirst({
      where: { boardId, userId: session.user.id },
    })

    if (!member) {
      return actionError('validation', 'You are not a member of this board')
    }

    await prisma.boardMember.delete({
      where: { id: member.id },
    })

    revalidateTag('boards', 'max')
    revalidateTag('board-detail', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to leave board')
  }
}
