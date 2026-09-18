/**
 * @fileoverview Board CRUD Server Actions
 *
 * This file contains all Server Actions related to board management (create, rename, delete).
 * Server Actions are async functions that run exclusively on the server and can be
 * called directly from Client Components — no API routes needed.
 *
 * WHY SERVER ACTIONS?
 * - Type-safe: TypeScript checks both client and server code
 * - No manual API endpoint creation required
 * - Automatic loading states via React's useTransition
 * - Enhanced security: code never reaches the client bundle
 *
 * AUTHORIZATION PATTERN:
 * Every action follows the same 3-step pattern:
 *   1. Authenticate: Get the current user's session (throws if not logged in)
 *   2. Authorize: Check if the user has permission (owner-only for mutations)
 *   3. Mutate: Perform the database operation
 *
 * CACHE INVALIDATION:
 * After each mutation, we call revalidateTag() to invalidate Next.js's fetch cache.
 * The client then invalidates TanStack Query's cache via queryClient.invalidateQueries().
 * This two-cache system ensures both server and client data stay fresh.
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions
 */

'use server' // Marks ALL exported functions in this file as Server Actions (server-only)

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'

/**
 * Creates a new board with the current user as the owner.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the user (redirects to /sign-in if not logged in)
 * 2. Creates a new Board record in the database
 * 3. Sets the current user as the board owner (ownerId)
 * 4. Invalidates the 'boards' cache tag so the dashboard refreshes
 * 5. Returns the newly created board object
 *
 * @param name - The display name for the board (e.g., "Sprint 42", "Marketing Campaign")
 * @returns The created Board object with id, name, ownerId, createdAt, updatedAt
 *
 * @example
 * // In a Client Component:
 * const board = await createBoard("My New Board")
 * router.push(`/boards/${board.id}`)
 */
export async function createBoard(name: string) {
  // Step 1: Authenticate — getRequiredSession() throws a redirect to /sign-in if no session
  const session = await getRequiredSession()
  
  // Step 2: Create the board in the database
  // The ownerId is set to the current user's ID, making them the owner
  const board = await prisma.board.create({
    data: {
      name,
      ownerId: session.user.id, // Owner is always the user who creates the board
    },
  })
  
  // Step 3: Invalidate the 'boards' cache tag
  // 'max' means stale content can be served for up to 1 year while revalidation runs
  // This ensures the dashboard will fetch fresh data on the next request
  revalidateTag('boards', 'max')
  
  // Return the board so the client can use it (e.g., redirect to the new board)
  return board
}

/**
 * Renames an existing board. Only the board owner can perform this action.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the user
 * 2. Fetches the board from the database
 * 3. Checks if the current user is the owner (throws if not)
 * 4. Updates the board name
 * 5. Invalidates both 'boards' and 'board-detail' cache tags
 * 6. Returns the updated board
 *
 * AUTHORIZATION:
 * Only the board owner can rename. Members (non-owners) will get a "Forbidden" error.
 * This is by design — see PRD section 6 (Owner vs. Member UI Differences).
 *
 * @param boardId - The unique identifier of the board to rename
 * @param name - The new display name for the board
 * @returns The updated Board object with the new name
 * @throws {Error} 'Forbidden: Only the board owner can rename the board' if user is not owner
 *
 * @example
 * await renameBoard("clx1234567890", "Renamed Board")
 */
export async function renameBoard(boardId: string, name: string) {
  // Step 1: Authenticate
  const session = await getRequiredSession()
  
  // Step 2: Fetch the board to check ownership
  // findUniqueOrThrow throws if the board doesn't exist (better than silent failure)
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })
  
  // Step 3: Authorize — only the owner can rename
  // This is a critical security check. Without it, any member could rename any board.
  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can rename the board')
  }
  
  // Step 4: Update the board name in the database
  const updatedBoard = await prisma.board.update({
    where: { id: boardId },
    data: { name },
  })
  
  // Step 5: Invalidate both cache tags
  // 'boards' — affects the dashboard list of boards
  // 'board-detail' — affects the individual board page (name displayed there)
  revalidateTag('boards', 'max')
  revalidateTag('board-detail', 'max')
  
  // Return the updated board for the client to use
  return updatedBoard
}

/**
 * Deletes a board and ALL its associated data (cascade deletion).
 * Only the board owner can perform this action.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the user
 * 2. Fetches the board from the database
 * 3. Checks if the current user is the owner (throws if not)
 * 4. Deletes the board — Prisma's onDelete: Cascade automatically deletes:
 *    - All todos in the board
 *    - All tags in the board
 *    - All board memberships (BoardMember records)
 *    - All pending invitations
 * 5. Invalidates the 'boards' cache tag
 *
 * CASCADE DELETION:
 * The Prisma schema defines `onDelete: Cascade` on all related models.
 * This means when a Board is deleted, ALL related records are automatically deleted too.
 * No manual cleanup code is needed — the database handles it.
 *
 * @param boardId - The unique identifier of the board to delete
 * @throws {Error} 'Forbidden: Only the board owner can delete the board' if user is not owner
 *
 * @example
 * await deleteBoard("clx1234567890")
 * // Board and all its data are permanently deleted
 */
export async function deleteBoard(boardId: string) {
  // Step 1: Authenticate
  const session = await getRequiredSession()
  
  // Step 2: Fetch the board to check ownership
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })
  
  // Step 3: Authorize — only the owner can delete
  // This is a destructive action, so we're extra careful
  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can delete the board')
  }
  
  // Step 4: Delete the board (and all related data via cascade)
  await prisma.board.delete({
    where: { id: boardId },
  })
  
  // Step 5: Invalidate the cache so the dashboard shows the updated list
  revalidateTag('boards', 'max')
}

/**
 * Transfers board ownership to another member. Only the current owner can do this.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the user
 * 2. Verifies the user is the current board owner
 * 3. Verifies the new owner is a current member of the board
 * 4. Updates the board's ownerId to the new owner
 * 5. The old owner loses settings access (no longer the owner)
 * 6. Invalidates both 'boards' and 'board-detail' cache tags
 *
 * AUTHORIZATION:
 * Only the current owner can transfer ownership.
 * The new owner must be an existing member of the board.
 *
 * @param boardId - The board to transfer ownership of
 * @param newOwnerId - The ID of the member to transfer ownership to
 * @throws {Error} If user is not the board owner
 * @throws {Error} If newOwnerId is the same as current owner
 * @throws {Error} If newOwnerId is not a member of the board
 *
 * @example
 * await transferOwnership("board_abc", "user_xyz")
 * // Board ownership transferred, old owner loses settings access
 */
export async function transferOwnership(boardId: string, newOwnerId: string) {
  // Step 1: Authenticate
  const session = await getRequiredSession()

  // Step 2: Fetch the board to check ownership
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })

  // Step 3: Authorize — only the current owner can transfer
  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can transfer ownership')
  }

  // Step 4: Cannot transfer to yourself
  if (newOwnerId === session.user.id) {
    throw new Error('Cannot transfer ownership to yourself')
  }

  // Step 5: Verify the new owner is a member of the board
  const member = await prisma.boardMember.findFirst({
    where: { boardId, userId: newOwnerId },
  })

  if (!member) {
    throw new Error('The user you are trying to transfer ownership to is not a member of this board')
  }

  // Step 6: Transfer ownership
  await prisma.board.update({
    where: { id: boardId },
    data: { ownerId: newOwnerId },
  })

  // Step 7: Invalidate both cache tags
  revalidateTag('boards', 'max')
  revalidateTag('board-detail', 'max')
}
