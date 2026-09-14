import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { boardsQueryOptions } from '@/lib/queries/boards'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery(boardsQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  )
}
