'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { activityFeedQueryOptions } from '@/lib/queries/board-keys'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { FORMER_MEMBER, activityPhrase } from '@/lib/activity-labels'
import type { ActivityWithActor } from '@/lib/types'

interface ActivityFeedProps {
  boardId: string
}

function formatActivityTime(createdAt: Date | string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Activity feed for one board — the paginated view of the board's Activity log.
 *
 * Infinite pagination (20 per page, newest → oldest): the first page holds the
 * most recent window, and "Load older" appends the previous window below it,
 * so the first paint is always the newest events (spec §Activity log).
 *
 * Only high-signal entries reach this list — the taxonomy is fixed at write
 * time (ADR-0002), so field-level edits and reorders are simply absent.
 *
 * An entry whose actor is null performed by an erased account renders as
 * "Former member"; a member who was only removed from the board keeps their
 * name (their account still exists).
 */
export function ActivityFeed({ boardId }: ActivityFeedProps) {
  const feed = useInfiniteQuery(activityFeedQueryOptions(boardId))

  // Pages arrive newest-window-first and each page is already newest → oldest,
  // so concatenating them preserves the display order.
  const entries: ActivityWithActor[] = (feed.data?.pages ?? []).flatMap(
    (page) => page.activities
  )

  return (
    <section className="flex flex-col gap-3" aria-label="Activity feed">
      {feed.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading activity…</p>
      ) : feed.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load activity.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const actorName = entry.actor?.name ?? FORMER_MEMBER
            const isFormerMember = entry.actor === null

            return (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 rounded-lg border p-3"
              >
                <p className="text-sm">
                  <span
                    className={
                      isFormerMember ? 'italic text-muted-foreground' : 'font-medium'
                    }
                  >
                    {actorName}
                  </span>{' '}
                  {activityPhrase(entry.action)}
                </p>
                <time
                  dateTime={new Date(entry.createdAt).toISOString()}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatActivityTime(entry.createdAt)}
                </time>
              </li>
            )
          })}
        </ul>
      )}

      {feed.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
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
      )}
    </section>
  )
}
