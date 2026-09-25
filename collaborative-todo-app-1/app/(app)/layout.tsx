import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/QueryProvider'
import { getRequiredSession } from '@/lib/session'
import { AppNav } from '@/components/AppNav'

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
  // renders reads TanStack Query (badge + dropdown poll).
  return (
    <QueryProvider>
      <AppNav email={session.user.email} />
      {children}
    </QueryProvider>
  )
}
