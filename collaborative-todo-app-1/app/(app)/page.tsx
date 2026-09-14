/**
 * @fileoverview Dashboard Page (Server Component)
 *
 * This is the root page of the authenticated app (route: /).
 * It displays all boards the user owns or is a member of.
 *
 * SERVER COMPONENT + PREFETCHING:
 * This is a Server Component that runs on the server during the initial request.
 * It prefetches board data and passes it to the client via HydrationBoundary.
 *
 * WHY PREFETCH ON THE SERVER?
 * - Zero-flash loading: Data arrives with the HTML, so the page renders immediately
 * - Better SEO: Search engines see the full content on first load
 * - Better performance: No loading skeleton flash for the user
 * - Works even if JavaScript is disabled (progressive enhancement)
 *
 * HOW IT WORKS:
 * 1. Server: Create a new QueryClient instance
 * 2. Server: prefetchQuery() fetches data and caches it
 * 3. Server: dehydrate() serializes the cache to JSON
 * 4. Server: Pass serialized cache to HydrationBoundary
 * 5. Client: HydrationBoundary restores the cache in the browser's QueryClient
 * 6. Client: useSuspenseQuery() in DashboardClient reads from the restored cache
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
 */

import { Suspense } from 'react'
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { boardsQueryOptions } from '@/lib/queries/boards'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

/**
 * Dashboard Page — Server Component
 *
 * This component runs on the server and prefetches board data.
 * It doesn't render any UI itself — it delegates to DashboardClient (a Client Component).
 *
 * WHY THE SPLIT?
 * - Server Component: Handles data fetching, authentication, and serialization
 * - Client Component: Handles interactivity (clicks, modals, mutations)
 * - HydrationBoundary: Bridges the two by passing server-fetched data to the client
 *
 * @returns A HydrationBoundary wrapping the DashboardClient
 */
export default async function DashboardPage() {
  // Step 1: Create a new QueryClient instance
  // IMPORTANT: Each request creates a NEW QueryClient to avoid data leaks between users
  // (unlike Client Components where we use useState to persist across renders)
  const queryClient = new QueryClient()

  // Step 2: Prefetch the boards data
  // This fetches GET /api/boards and caches the result in the QueryClient
  // The await ensures the data is fetched before the page renders
  await queryClient.prefetchQuery(boardsQueryOptions())

  // Step 3: Serialize the cache and render
  // dehydrate() converts the QueryClient's cache to a serializable JSON object
  // HydrationBoundary passes this JSON to the client, where it's restored
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading...</div>}>
        <DashboardClient />
      </Suspense>
    </HydrationBoundary>
  )
}
