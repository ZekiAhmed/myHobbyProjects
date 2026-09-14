'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'

/**
 * Creates a new board with the current user as owner.
 * 
 * @param name - The name of the board
 * @returns The created board
 */
export async function createBoard(name: string) {
  const session = await getRequiredSession()
  
  const board = await prisma.board.create({
    data: {
      name,
      ownerId: session.user.id,
    },
  })
  
  revalidateTag('boards', 'max')
  
  return board
}

/**
 * Renames a board. Only the owner can rename.
 * 
 * @param boardId - The ID of the board to rename
 * @param name - The new name for the board
 * @returns The updated board
 */
export async function renameBoard(boardId: string, name: string) {
  const session = await getRequiredSession()
  
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })
  
  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can rename the board')
  }
  
  const updatedBoard = await prisma.board.update({
    where: { id: boardId },
    data: { name },
  })
  
  revalidateTag('boards', 'max')
  revalidateTag('board-detail', 'max')
  
  return updatedBoard
}

/**
 * Deletes a board and all its associated data (todos, tags, members, invitations).
 * Only the owner can delete.
 * 
 * @param boardId - The ID of the board to delete
 */
export async function deleteBoard(boardId: string) {
  const session = await getRequiredSession()
  
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })
  
  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can delete the board')
  }
  
  await prisma.board.delete({
    where: { id: boardId },
  })
  
  revalidateTag('boards', 'max')
}
