import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'A collaborative Kanban todo app for small teams.',
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
