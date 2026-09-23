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

  return (
    <>
      <AppNav email={session.user.email} />
      <QueryProvider>{children}</QueryProvider>
    </>
  )
}
