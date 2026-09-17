/**
 * @fileoverview Invitation Server Actions
 *
 * This file contains Server Actions for managing board invitations:
 * - createInvitation: Send an invite by email (owner only)
 * - revokeInvitation: Cancel a pending invitation (owner only)
 * - acceptInvitation: Consume an invitation token and become a member
 *
 * INVITATION FLOW:
 * 1. Owner enters an email address on the board settings page
 * 2. createInvitation generates a secure token and stores it in the Invitation table
 * 3. An email is sent with a link: /invite/[token]
 * 4. The invitee clicks the link and is handled by /invite/[token] page
 * 5. acceptInvitation validates the token and creates a BoardMember record
 *
 * SECURITY:
 * - Only board owners can create/revoke invitations
 * - Tokens use crypto.randomBytes(32) — not cuid() (see lib/utils/invite-tokens.ts)
 * - Tokens expire after 48 hours
 * - Rate limiting is applied at the API route level (see app/api/invitations/route.ts)
 *
 * @see lib/utils/invite-tokens.ts — Token generation
 * @see prisma/schema.prisma — Invitation model
 */

'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { generateInviteToken, getInvitationExpiry, isTokenExpired } from '@/lib/utils/invite-tokens'
import { sendInvitationEmail } from '@/lib/email'

/**
 * Creates a new invitation for a user to join a board.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the current user
 * 2. Verifies the user is the board owner
 * 3. Checks if the email is already a member or has a pending invite
 * 4. Generates a cryptographically secure token
 * 5. Creates an Invitation record with 48h expiry
 * 6. Sends an invitation email via Resend
 * 7. Invalidates the board-detail cache
 *
 * @param boardId - The board to invite the user to
 * @param email - The email address of the person to invite
 * @returns The created Invitation object
 * @throws {Error} If user is not the board owner
 * @throws {Error} If the user is already a member
 * @throws {Error} If there's already a pending invitation for this email
 *
 * @example
 * const invitation = await createInvitation("board_abc", "colleague@example.com")
 * // Invitation email sent, record created in database
 */
export async function createInvitation(boardId: string, email: string) {
  const session = await getRequiredSession()

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })

  if (board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can invite members')
  }

  const existingMember = await prisma.boardMember.findFirst({
    where: { boardId, user: { email } },
  })

  if (existingMember) {
    throw new Error('This user is already a member of this board')
  }

  const pendingInvitation = await prisma.invitation.findFirst({
    where: { boardId, email, status: 'PENDING' },
  })

  if (pendingInvitation) {
    if (!isTokenExpired(pendingInvitation.expiresAt)) {
      throw new Error('A pending invitation already exists for this email')
    }
  }

  const token = generateInviteToken()
  const expiresAt = getInvitationExpiry()

  const invitation = await prisma.invitation.create({
    data: {
      boardId,
      email,
      token,
      expiresAt,
    },
  })

  try {
    await sendInvitationEmail(email, token, board.name)
  } catch {
    // Invitation is saved even if email fails — share the link manually
  }

  revalidateTag('board-detail', 'max')

  return invitation
}

/**
 * Revokes (cancels) a pending invitation.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the current user
 * 2. Verifies the user is the board owner
 * 3. Deletes the Invitation record
 * 4. Invalidates the board-detail cache
 *
 * @param invitationId - The invitation to revoke
 * @throws {Error} If user is not the board owner
 *
 * @example
 * await revokeInvitation("inv_abc123")
 * // Invitation deleted, invite link is now invalid
 */
export async function revokeInvitation(invitationId: string) {
  const session = await getRequiredSession()

  const invitation = await prisma.invitation.findUniqueOrThrow({
    where: { id: invitationId },
    include: { board: true },
  })

  if (invitation.board.ownerId !== session.user.id) {
    throw new Error('Forbidden: Only the board owner can revoke invitations')
  }

  await prisma.invitation.delete({
    where: { id: invitationId },
  })

  revalidateTag('board-detail', 'max')
}

/**
 * Accepts an invitation using a token and creates a board membership.
 *
 * WHAT HAPPENS:
 * 1. Authenticates the current user via session
 * 2. Validates the token exists and is not expired
 * 3. Checks the invitation status is PENDING
 * 4. Creates a BoardMember record linking the user to the board
 * 5. Updates the invitation status to ACCEPTED
 * 6. Invalidates both 'boards' and 'board-detail' cache tags
 *
 * SECURITY:
 * - User is resolved from session (not passed as parameter)
 * - Token must be a valid hex string
 * - Token must not be expired (48h window)
 * - Token must have PENDING status (not already used)
 *
 * @param token - The invitation token from the URL
 * @returns The board ID the user was invited to
 * @throws {Error} If not authenticated, token is invalid, expired, or already used
 *
 * @example
 * const { boardId } = await acceptInvitation("a1b2c3d4...")
 * // User is now a member of the board
 * // redirect(`/boards/${boardId}`)
 */
export async function acceptInvitation(token: string) {
  const session = await getRequiredSession()
  const userId = session.user.id

  const invitation = await prisma.invitation.findUnique({
    where: { token },
  })

  if (!invitation) {
    throw new Error('Invalid invitation link')
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('This invitation has already been used')
  }

  if (isTokenExpired(invitation.expiresAt)) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'EXPIRED' },
    })
    throw new Error('This invitation link has expired. Ask the board owner to send a new one.')
  }

  const existingMember = await prisma.boardMember.findFirst({
    where: { boardId: invitation.boardId, userId },
  })

  if (existingMember) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    })
    return { boardId: invitation.boardId }
  }

  await prisma.$transaction([
    prisma.boardMember.create({
      data: {
        boardId: invitation.boardId,
        userId,
      },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    }),
  ])

  revalidateTag('boards', 'max')
  revalidateTag('board-detail', 'max')

  return { boardId: invitation.boardId }
}
