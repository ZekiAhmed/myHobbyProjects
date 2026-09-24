import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Kanban — Collaborative todo app for small teams',
  description:
    'A collaborative Kanban board for small teams. Organize tasks, track progress, and ship work together in real time.',
  openGraph: {
    title: 'Kanban — Collaborative todo app for small teams',
    description:
      'A collaborative Kanban board for small teams. Organize tasks, track progress, and ship work together in real time.',
    type: 'website',
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-12 items-center justify-between gap-4 px-4 md:px-6">
          <Link
            href="/"
            className="text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
          >
            Kanban
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/sign-in" />}
              nativeButton={false}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              render={<Link href="/sign-up" />}
              nativeButton={false}
            >
              Get started
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
          Kanban — a collaborative todo app for small teams.
        </div>
      </footer>
    </div>
  )
}
