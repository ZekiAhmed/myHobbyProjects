/**
 * @fileoverview GET /api/notifications — Fetch one page of the acting user's Notifications
 *
 * The global bell's read endpoint: page + unread count in one response, both
 * scoped to the signed-in user (there is no cross-user or board-scoped view).
 *
 * PAGINATION CONTRACT:
 * - 20 Notifications per page (PAGE_SIZE), newest → oldest (dropdown order)
 * - ?before=<notificationId> returns the page of rows older than that cursor
 * - Response: { notifications, nextCursor, unreadCount } — nextCursor is the
 *   id of the oldest returned row when older pages exist, otherwise null
 * - The full list is never fetched (spec "Pagination rule")
 *
 * UNREAD COUNT:
 * `unreadCount` is the count of this user's rows with `readAt IS NULL` — the
 * badge value. Returned alongside the page so one 8-second poll refreshes
 * both surfaces.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const session = await getRequiredSession()

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')

  let cursor: { id: string; createdAt: Date } | null = null
  if (before) {
    cursor = await prisma.notification.findUnique({
      where: { id: before, userId: session.user.id },
      select: { id: true, createdAt: true },
    })
    if (!cursor) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }
  }

  const [unreadCount, rows] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
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
        type: true,
        readAt: true,
        createdAt: true,
        boardId: true,
        actor: { select: { id: true, name: true, image: true } },
        todo: { select: { id: true, title: true } },
      },
      take: PAGE_SIZE + 1,
    }),
  ])

  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)
  const nextCursor = hasMore ? page[page.length - 1].id : null

  return NextResponse.json({ notifications: page, nextCursor, unreadCount })
}
