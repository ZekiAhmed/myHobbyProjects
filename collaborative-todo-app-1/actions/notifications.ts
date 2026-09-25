'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'

/**
 * Mark one Notification read — the acting user's row only.
 *
 * Ownership is checked against the row itself, and the write is additionally
 * scoped to the acting user, so a Notification addressed to someone else can
 * never be marked read from this entrypoint. Re-marking an already-read row
 * is a no-op that still succeeds (idempotent click-through).
 */
export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getRequiredSession()

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, userId: true, readAt: true },
    })

    if (!notification) return actionError('server', 'Notification not found')
    if (notification.userId !== session.user.id) {
      return actionError('authorization', 'You can only mark your own notifications')
    }

    if (notification.readAt === null) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: session.user.id, readAt: null },
        data: { readAt: new Date() },
      })
    }

    revalidateTag('notifications', 'max')

    return actionSuccess({ id: notification.id })
  } catch {
    return actionError('server', 'Failed to mark notification read')
  }
}

/**
 * Mark every unread Notification of the acting user read — one call.
 *
 * The where clause names only the acting user, so no other recipient's unread
 * rows are ever touched (spec: "mark all as read" resets this user's badge).
 */
export async function markAllNotificationsRead(): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await getRequiredSession()

    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    })

    revalidateTag('notifications', 'max')

    return actionSuccess({ count: result.count })
  } catch {
    return actionError('server', 'Failed to mark notifications read')
  }
}
