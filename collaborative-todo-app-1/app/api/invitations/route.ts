/**
 * @fileoverview GET /api/invitations — Fetch pending invitations for a board
 *
 * Returns all pending invitations for a specific board.
 * Only accessible by the board owner.
 *
 * USED BY:
 * - InviteForm component to display pending invitations with revoke buttons
 *
 * @see app/actions/invitations.ts — Server Actions for creating/revoking invitations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()

  const { searchParams } = new URL(request.url)
  const boardId = searchParams.get('boardId')

  if (!boardId) {
    return NextResponse.json(
      { error: 'boardId query parameter is required' },
      { status: 400 }
    )
  }

  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
  })

  if (board.ownerId !== session.user.id) {
    return NextResponse.json(
      { error: 'Forbidden: Only the board owner can view invitations' },
      { status: 403 }
    )
  }

  const invitations = await prisma.invitation.findMany({
    where: { boardId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(invitations)
}
