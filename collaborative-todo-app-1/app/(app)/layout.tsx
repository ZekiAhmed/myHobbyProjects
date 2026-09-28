import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/QueryProvider'
import { getRequiredSession } from '@/lib/session'
import { AppNav } from '@/components/AppNav'
import { PendingReviewBanner } from '@/components/subscription/PendingReviewBanner'

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'A collaborative Kanban todo app for small teams.',
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getRequiredSession()

  // AppNav must live inside QueryProvider: the global Notification bell it
  // renders reads TanStack Query (badge + dropdown poll). The pending-review
  // banner reads the same provider (subscription-billing issue 06) and
  // mounts here, under the nav, so the subscriber sees their under-review
  // submission on the dashboard and every other app page — non-blocking,
  // never shown to a team Member (it only ever renders the acting user's
  // own PENDING attempt).
  return (
    <QueryProvider>
      <AppNav email={session.user.email} />
      <PendingReviewBanner />
      {children}
    </QueryProvider>
  )
}
