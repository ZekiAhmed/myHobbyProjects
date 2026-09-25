import Link from 'next/link'
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
          Kanban
        </Link>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:block lg:max-w-[280px]"
            title={email}
          >
            {email}
          </span>
          <NotificationBell />
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
