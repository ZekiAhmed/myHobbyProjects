/**
 * @fileoverview GET /api/boards/[id]/activity — Fetch one page of a board's Activity feed
 *
 * Returns the newest window of the Activity log so the client can page
 * backward with "Load older"; entries stay newest → oldest (the feed's
 * display order) — unlike the Comment feed, nothing is reversed.
 *
 * PAGINATION CONTRACT:
 * - 20 entries per page (PAGE_SIZE)
 * - ?before=<activityId> returns the page of entries older than that cursor
 * - Response: { activities, nextCursor } — nextCursor is the id of the oldest
 *   returned entry when older pages exist, otherwise null (log exhausted)
 * - The full log is never fetched (spec "Pagination rule", TRD §9)
 *
 * AUTHORIZATION:
 * - User must be the board owner OR a member of the board
 *   (same check as board detail) — 403 otherwise, even with a valid board id
 * - Unknown board → 404
 *
 * PAYLOAD:
 * The actor is resolved inline (`SetNull` → null, rendered as "Former member"
 * by the feed). `ipAddress` is a compliance column (ADR-0002) and is not
 * returned to board members.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

const PAGE_SIZE = 20

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequiredSession()
  const { id } = await params

  const board = await prisma.board.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
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

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')

  let cursor: { id: string; createdAt: Date } | null = null
  if (before) {
    cursor = await prisma.activity.findUnique({
      where: { id: before, boardId: id },
      select: { id: true, createdAt: true },
    })
    if (!cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
  }

  const rows = await prisma.activity.findMany({
    where: {
      boardId: id,
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      action: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      actor: { select: { id: true, name: true, image: true } },
    },
    take: PAGE_SIZE + 1,
  })

  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({ activities: page, nextCursor })
}
