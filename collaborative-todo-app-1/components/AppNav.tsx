import Link from 'next/link'
import { Settings } from 'lucide-react'
import { SignOutButton } from '@/components/SignOutButton'
import { NotificationBell } from '@/components/NotificationBell'

export function AppNav({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container mx-auto flex h-12 items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href="/boards"
          className="text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
        >
          Kanify
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:block lg:max-w-[280px]"
            title={email}
          >
            {email}
          </span>
          <NotificationBell />
          <Link
            href="/upgrade"
            className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            Upgrade
          </Link>
          <Link
            href="/settings"
            aria-label="Account settings"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[4px] border border-transparent text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
