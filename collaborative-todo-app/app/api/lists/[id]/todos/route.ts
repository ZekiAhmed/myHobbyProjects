// THE POLLED ENDPOINT — hit every 8 seconds per open board by every active
// user (see TDD §9 scalability: ~125 reads/sec at 1,000 concurrent users).
// Keep this query as tight and index-friendly as possible; the
// @@index([listId, status]) index in schema.prisma exists specifically to
// keep this fast.
//
// Supports an optional ?status= filter, which the client currently doesn't
// use (it fetches the whole board and filters client-side per PRD feature
// #22) but which is already wired up as an escape hatch for when a list
// grows past ~300 todos (see TDD §9 pagination strategy table).

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { NextResponse } from 'next/server'
import type { TodoStatus } from '@/lib/generated/prisma/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getRequiredSession()

  const list = await prisma.list.findUnique({ where: { id } })
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const isOwner = list.ownerId === session.user.id
  const isMember = isOwner
    ? true
    : Boolean(await prisma.listMember.findFirst({ where: { listId: id, userId: session.user.id } }))

  if (!isMember) {
    return new Response('Forbidden', { status: 403 })
  }

  // Optional status filter — e.g. /api/lists/abc123/todos?status=DONE
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') as TodoStatus | null

  const todos = await prisma.todo.findMany({
    where: {
      listId: id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    // Both includes below exist to avoid the classic "N+1 query" bug:
    // fetching todos first and then looping to fetch each one's assignee
    // and tags separately would mean 1 + N + N queries for N todos.
    // Doing it here means exactly ONE query, full stop.
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
    // Sorting by the fractional-index `order` string ascending gives the
    // correct drag-and-drop order directly from the database — no
    // client-side re-sorting needed.
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(todos)
}