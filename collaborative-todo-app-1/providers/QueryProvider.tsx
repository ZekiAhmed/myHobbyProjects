/**
 * @fileoverview TanStack Query Provider
 *
 * This component provides the TanStack Query client to the entire app.
 * It wraps the app's children with QueryClientProvider, making the query client
 * available to all components that use useQuery, useMutation, or useSuspenseQuery.
 *
 * WHY A PROVIDER?
 * TanStack Query uses React Context to share the query client across the app.
 * Without this provider, useQuery/useMutation hooks would throw an error.
 *
 * PLACEMENT:
 * This provider is placed in app/(app)/layout.tsx (the authenticated shell).
 * This means:
 * - Auth pages (/sign-in, /sign-up) don't have QueryClient (not needed)
 * - Dashboard and board pages DO have QueryClient
 * - Each route group gets its own QueryClient if needed (not the case here)
 *
 * QUERY CLIENT CREATION:
 * We use useState() to create the QueryClient once per component mount.
 * This ensures:
 * - The QueryClient persists across re-renders (not recreated on every render)
 * - The QueryClient is NOT shared between users (server-side rendering safety)
 * - In development, hot-reloads don't create duplicate clients
 *
 * WHY useState() WITH A CALLBACK?
 * useState(() => new QueryClient()) creates the client lazily (only once).
 * useState(new QueryClient()) would create it on every render (bad!).
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/overview
 */

'use client' // Client Component — uses React Context and hooks

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

/**
 * QueryProvider — wraps children with the TanStack Query client
 *
 * @param children - React children to wrap with the QueryClientProvider
 * @returns The children wrapped with QueryClientProvider and devtools
 *
 * @example
 * // In layout.tsx:
 * <QueryProvider>
 *   <DashboardClient />
 * </QueryProvider>
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  /**
   * Create the QueryClient once per component mount
   *
   * HOW IT WORKS:
   * - useState() with a callback: The callback runs only once (on mount)
   * - The returned value is the QueryClient instance
   * - On subsequent renders, useState returns the same instance (no new client)
   *
   * DEFAULT OPTIONS:
   * - staleTime: 30_000ms (30 seconds)
   *   Data is considered "stale" after 30 seconds.
   *   On next use, it refetches in the background.
   *
   * - gcTime: 300_000ms (5 minutes)
   *   Unused data is kept in cache for 5 minutes.
   *   After 5 minutes without use, it's garbage collected.
   *
   * These defaults can be overridden per-query in queryOptions().
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,  // 30 seconds — data is fresh for 30s
            gcTime: 300_000,    // 5 minutes — keep unused data in cache
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      
      {/* React Query Devtools (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
