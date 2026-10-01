import { cn } from 'cn'
import type { ReactNode } from 'react'

export function AuthPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4 py-8">
      <div
        className={cn(
          'w-full max-w-md p-8 bg-card rounded-xl ring-1 ring-foreground/10',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
