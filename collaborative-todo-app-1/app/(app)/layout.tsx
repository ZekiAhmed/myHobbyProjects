import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/QueryProvider'

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'A collaborative Kanban todo app for small teams.',
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <QueryProvider>{children}</QueryProvider>
}
