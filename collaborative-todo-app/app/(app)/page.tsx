// Implements PRD Goal #1 (fast onboarding) via SERVER-SIDE PREFETCHING:
// we fetch the list data on the server BEFORE sending any HTML to the
// browser, then "hydrate" that data into the client-side TanStack Query
// cache. The result: the dashboard's data is already present in the very
// first HTML the browser receives — no loading spinner flash on first
// visit (see TDD §9 performance target: dashboard first paint < 200ms).

import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { listsQueryOptions } from "@/lib/queries/lists";
import { getRequiredSession } from "@/lib/session";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  // Real auth check happens here, server-side, on every request — NOT
  // assumed from the (app) layout or from proxy.ts.
  await getRequiredSession();

  // A fresh QueryClient per request (server-rendering must never share
  // state between different users' requests).
  const queryClient = new QueryClient();

  // This runs the SAME fetcher function that the client will later use —
  // guaranteeing the server-rendered data and the client cache key match
  // up perfectly, avoiding a mismatch/refetch-flash on hydration.
  await queryClient.prefetchQuery(listsQueryOptions());

  return (
    // dehydrate() serializes the QueryClient's cache into plain data that
    // can be sent to the browser as part of the HTML/RSC payload.
    // HydrationBoundary on the client reads it back into a real
    // TanStack Query cache before DashboardClient's first render.
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
