/**
 * @fileoverview GET /api/boards/[id] — Fetch board detail with members and tags
 *
 * Returns a single board with its members, tags, and owner information.
 * Used by the board detail page and the Kanban board.
 *
 * AUTHORIZATION:
 * - User must be the board owner OR a member of the board
 * - Returns 403 if the user has no access
 *
 * DATA INCLUDED:
 * - Board: id, name, ownerId, createdAt, updatedAt
 * - Members: user id, name, email, image, joinedAt
 * - Tags: id, name, color
 * - Owner: id, name, email, image
 *
 * @see lib/queries/board-keys.ts — Query key factory
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession()
  const { id } = await params

  const board = await prisma.board.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      tags: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!board) {
    return NextResponse.json(
      { error: 'Board not found' },
      { status: 404 }
    )
  }

  const isOwner = board.ownerId === session.user.id
  const isMember = board.members.some(
    (m) => m.userId === session.user.id
  )

  if (!isOwner && !isMember) {
    return NextResponse.json(
      { error: 'Forbidden: You are not a member of this board' },
      { status: 403 }
    )
  }

  return NextResponse.json(board)
}
