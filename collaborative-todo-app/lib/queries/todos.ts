// This is the query that powers "near-real-time" teammate sync (PRD Goal #3:
// "all members see teammates' changes within 10 seconds"). We accomplish
// this with polling — refetchInterval: 8000 — rather than WebSockets, per
// the TDD's documented trade-off (simpler to build/debug at MVP scale;
// WebSocket migration later would reuse this exact same cache-invalidation
// pattern, just triggered by a push event instead of a timer).

import { queryOptions } from '@tanstack/react-query'
import { listKeys } from './lists'

export const todosQueryOptions = (listId: string) =>
  queryOptions({
    queryKey: listKeys.todos(listId),
    queryFn: () => fetch(`/api/lists/${listId}/todos`).then((r) => r.json()),

    // staleTime: 0 means "always consider this data stale" — which forces
    // TanStack Query to actually refetch on every interval tick, rather
    // than skipping a refetch because it thinks the data is still "fresh."
    staleTime: 0,

    gcTime: 300_000,

    // The actual polling interval. 8 seconds balances "feels near-real-time"
    // against "doesn't hammer the database" — see TDD §9 scalability math
    // (~125 DB reads/sec at 1,000 concurrently active users).
    refetchInterval: 8_000,

    // If a poll request fails (e.g. brief network blip), retry a few times
    // with backoff before giving up and showing the user a "having trouble
    // syncing" toast (see TDD §9 availability table).
    retry: 3,
  })