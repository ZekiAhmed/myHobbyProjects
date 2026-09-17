/**
 * @fileoverview GET /api/boards/[id]/todos — Fetch todos for a board
 *
 * Returns todos with assignee and tags, ordered by fractional index.
 * Supports optional ?status= filter query parameter.
 *
 * AUTHORIZATION:
 * - User must be the board owner OR a member of the board
 * - Returns 403 if the user has no access
 *
 * DATA INCLUDED:
 * - Todo: id, title, description, status, priority, dueDate, order, createdAt, updatedAt
 * - Assignee: id, name, image (optional)
 * - Tags: id, name, color
 *
 * @see lib/queries/board-keys.ts — Query key factory
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession()
  const { id } = await params

  // Check membership
  const board = await prisma.board.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!board) {
    return NextResponse.json(
      { error: 'Board not found' },
      { status: 404 }
    )
  }

  const isOwner = board.ownerId === session.user.id
  const isMember = await prisma.boardMember.findFirst({
    where: { boardId: id, userId: session.user.id },
  })

  if (!isOwner && !isMember) {
    return NextResponse.json(
      { error: 'Forbidden: You are not a member of this board' },
      { status: 403 }
    )
  }

  // Get optional status filter
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  // Build where clause
  const where: Record<string, unknown> = { boardId: id }
  if (statusFilter && ['TO_DO', 'IN_PROGRESS', 'DONE'].includes(statusFilter)) {
    where.status = statusFilter
  }

  // Fetch todos with assignee and tags
  const todos = await prisma.todo.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, image: true },
      },
      tags: {
        include: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(todos)
}
