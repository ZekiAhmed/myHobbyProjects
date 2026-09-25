'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { notificationKeys, notificationsQueryOptions } from '@/lib/queries/board-keys'
import { emitFocusTodo } from '@/lib/focus-todo'
import { markAllNotificationsRead, markNotificationRead } from '@/actions/notifications'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import type { NotificationWithRefs } from '@/lib/types'

function formatNotificationTime(createdAt: Date | string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * One-line summary of why the Notification exists.
 *
 * Only `ASSIGNED` rows exist until ticket 06 (comment notifications) lands,
 * but the copy already handles the rest of the designed matrix so the bell
 * needs no rewrite when `COMMENTED` rows appear.
 */
function notificationSummary(notification: NotificationWithRefs): string {
  const actor = notification.actor?.name ?? 'Someone'
  switch (notification.type) {
    case 'ASSIGNED':
      return `${actor} assigned you to “${notification.todo.title}”`
    case 'COMMENTED':
      return `${actor} commented on “${notification.todo.title}”`
    default:
      // Unknown/newer type than this client knows — generic copy rather
      // than a summary that claims an event that may not have happened.
      return `${actor} updated “${notification.todo.title}”`
  }
}

/**
 * Global Notification bell — badge + dropdown, rendered in the app shell.
 *
 * - Badge: the acting user's unread count (rows with `readAt` null); hidden
 *   at zero so the chrome stays quiet (spec req 36)
 * - Dropdown: the latest 20 Notifications newest → oldest, with progressive
 *   "Load older" paging — never a full-list fetch (spec "Pagination rule")
 * - Polls on the same 8-second cadence as todos while signed in (req 41)
 * - Click-through navigates to the Notification's Todo with the side panel
 *   focused (`?todo=` deep link) and marks that row read (reqs 38–39)
 * - "Mark all as read" resets the badge in one call (req 40)
 *
 * Both mutations follow the two-cache invalidation rule: the server action
 * revalidates the `notifications` tag, this client invalidates
 * `notificationKeys.all()` on success.
 */
export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const feed = useInfiniteQuery(notificationsQueryOptions())

  const invalidateBell = () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.all() })

  const markOneMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: (result) => {
      if (result.success) {
        invalidateBell()
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to mark notification read')
    },
  })

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: (result) => {
      if (result.success) {
        invalidateBell()
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to mark notifications read')
    },
  })

  const notifications: NotificationWithRefs[] = (feed.data?.pages ?? []).flatMap(
    (page) => page.notifications
  )
  const unreadCount = feed.data?.pages[0]?.unreadCount ?? 0

  const handleOpenNotification = (notification: NotificationWithRefs) => {
    // Navigate first — marking read is a follow-up write that must not delay
    // landing on the Todo. A failure keeps the row unread and toasts.
    markOneMutation.mutate(notification.id)
    setOpen(false)
    router.push(`/boards/${notification.boardId}?todo=${encodeURIComponent(notification.todo.id)}`)
    // A repeat click is an identical URL (a Next.js no-op) — hand the id to
    // the mounted board directly so its side panel refocuses anyway.
    emitFocusTodo(notification.todo.id)
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => setOpen(nextOpen)}>
      <PopoverTrigger
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-transparent text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-medium text-destructive-foreground"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-80 gap-2 p-0">
        <PopoverHeader className="flex-row items-center justify-between gap-2 border-b p-3">
          <div className="flex flex-col gap-0.5">
            <PopoverTitle>Notifications</PopoverTitle>
            <PopoverDescription className="text-xs">
              {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
            </PopoverDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
            >
              {markAllMutation.isPending ? 'Marking…' : 'Mark all as read'}
            </Button>
          )}
        </PopoverHeader>

        <div className="max-h-96 overflow-y-auto px-1 pb-1">
          {feed.isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Loading notifications…</p>
          ) : feed.isError ? (
            <p className="px-2 py-4 text-sm text-destructive">Couldn&apos;t load notifications.</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            <ul className="flex flex-col">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenNotification(notification)}
                    className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      className={
                        notification.readAt === null
                          ? 'text-sm font-medium text-foreground'
                          : 'text-sm text-muted-foreground'
                      }
                    >
                      {notificationSummary(notification)}
                    </span>
                    <time
                      dateTime={new Date(notification.createdAt).toISOString()}
                      className="text-xs text-muted-foreground"
                    >
                      {formatNotificationTime(notification.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {feed.hasNextPage && notifications.length > 0 && (
            <div className="p-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {feed.isFetchingNextPage ? (
                  <>
                    <Spinner /> Loading…
                  </>
                ) : (
                  'Load older'
                )}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
