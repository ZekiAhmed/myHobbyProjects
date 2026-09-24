/**
 * @fileoverview GET /api/todos/[id]/comments — Fetch one page of a Todo's Comment feed
 *
 * Returns the newest-first window of the feed so the client can page backward
 * with "Load older"; items inside a page are ordered oldest → newest.
 *
 * PAGINATION CONTRACT:
 * - 20 comments per page (PAGE_SIZE)
 * - ?before=<commentId> returns the page of comments older than that cursor
 * - Response: { comments, nextCursor } — nextCursor is the id of the oldest
 *   returned comment when older pages exist, otherwise null (feed exhausted)
 *
 * AUTHORIZATION:
 * - User must be the board owner OR a member of the todo's board
 *   (same check as board detail) — 403 otherwise, even with a valid Todo id
 * - Unknown todo → 404
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

  const todo = await prisma.todo.findUnique({
    where: { id },
    select: { boardId: true },
  })

  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  const board = await prisma.board.findUnique({
    where: { id: todo.boardId },
    select: { ownerId: true },
  })

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const isOwner = board.ownerId === session.user.id
  const isMember = await prisma.boardMember.findFirst({
    where: { boardId: todo.boardId, userId: session.user.id },
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
    cursor = await prisma.comment.findUnique({
      where: { id: before, todoId: id },
      select: { id: true, createdAt: true },
    })
    if (!cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
  }

  const rows = await prisma.comment.findMany({
    where: {
      todoId: id,
      ...(cursor && {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { author: { select: { id: true, name: true, image: true } } },
    take: PAGE_SIZE + 1,
  })

  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].id : null
  const comments = page.reverse()

  return NextResponse.json({ comments, nextCursor })
}
