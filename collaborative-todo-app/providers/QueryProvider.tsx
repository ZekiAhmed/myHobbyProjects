// Wraps the app in a single TanStack QueryClient. The `useState(() => ...)`
// pattern (rather than a plain module-level `new QueryClient()`) is
// IMPORTANT in Next.js: it guarantees each user/request gets their OWN
// client instance during server rendering, rather than accidentally
// sharing one QueryClient (and its cache) across different users' requests.

'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A conservative app-wide default; individual queries (like
            // todosQueryOptions) override this when they need something
            // more aggressive (e.g. staleTime: 0 for polling).
            staleTime: 10_000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Devtools are tree-shaken out of production builds automatically
          when NODE_ENV === 'production', so it's safe to always render this. */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}