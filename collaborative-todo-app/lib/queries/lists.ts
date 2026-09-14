// Defines the TanStack Query "query keys" and "query options" for
// everything related to Lists (the dashboard list-of-lists, and a single
// list's detail — members + tags).
//
// WHY queryOptions() INSTEAD OF INLINE useQuery({...}) EVERYWHERE?
// Using the same options object for both server-side prefetchQuery() calls
// AND client-side useSuspenseQuery() calls guarantees the cache key and
// fetch logic can never drift apart between server and client — which
// would otherwise cause an annoying "flash of stale content" bug.

import { queryOptions } from "@tanstack/react-query";
import { fetchLists, fetchList } from "../api/lists";

// Centralized query-key factory. Using functions (not raw arrays) means
// TypeScript can catch typos, and invalidating "all list-related queries"
// vs. "just this one list" is a single readable call.
export const listKeys = {
  all: () => ["lists"] as const,
  detail: (id: string) => ["lists", id] as const,
  todos: (id: string) => ["lists", id, "todos"] as const,
};

/** The dashboard's "all lists I own or belong to" query. */
export const listsQueryOptions = () =>
  queryOptions({
    queryKey: listKeys.all(),
    queryFn: () => fetchLists(),
    // Lists (their names, counts) don't change often — 30s of "don't
    // refetch even if a component remounts" is a safe, cheap default.
    staleTime: 30_000,
    gcTime: 300_000,
  });

/** A single list's metadata: members + tags (NOT todos — see todosQueryOptions). */
export const listDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: listKeys.detail(id),
    queryFn: () => fetchList(id),
    // Members/tags only change via owner-only actions, which is rare
    // relative to how often todos change — safe to cache for 30s.
    staleTime: 30_000,
    gcTime: 300_000,
  });
