import { cn } from 'cn'
import type { ReactNode } from 'react'

interface PageShellProps {
  title: ReactNode
  actions?: ReactNode
  leading?: ReactNode
  narrow?: boolean
  children: ReactNode
}

export function PageShell({
  title,
  actions,
  leading,
  narrow = false,
  children,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-4 md:px-6 md:py-8',
        narrow ? 'max-w-2xl' : 'container'
      )}
    >
      <header className="mb-6 flex items-center justify-between gap-4 md:mb-8">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <h1 className="truncate text-2xl font-bold md:text-3xl">{title}</h1>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </div>
  )
}
