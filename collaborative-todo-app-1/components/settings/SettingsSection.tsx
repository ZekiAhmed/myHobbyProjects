/**
 * @fileoverview Shared settings card section
 *
 * Every settings surface (board, account) is a stack of these cards:
 * rounded-xl, hairline ring, 16px padding, optional h3 title. A second
 * tone exists for the danger zone — same anatomy, red ring and heading.
 *
 * Usage rules:
 * - `title` is optional: omit it when the content titles itself (the
 *   session list renders its own heading)
 * - `titleClassName` tightens the heading when a description follows
 *   (`mb-1` instead of the default `mb-3`)
 * - `className` places the card in context (`mt-4` between siblings)
 */

import type { ReactNode } from 'react'

interface SettingsSectionProps {
  /** Section heading rendered as an h3; omit when the content titles itself */
  title?: ReactNode
  /** danger swaps the ring and heading ink to the danger tone */
  tone?: 'default' | 'danger'
  /** Heading margin override for tight heading+description stacks (e.g. `mb-1`) */
  titleClassName?: string
  /** Section spacing in context (e.g. `mt-4` between sibling sections) */
  className?: string
  children: ReactNode
}

export function SettingsSection({
  title,
  tone = 'default',
  titleClassName,
  className,
  children,
}: SettingsSectionProps) {
  const danger = tone === 'danger'
  const extra = className ? ` ${className}` : ''

  return (
    <section
      className={`bg-card rounded-xl p-4 ring-1 ${danger ? 'ring-red-200' : 'ring-foreground/10'}${extra}`}
    >
      {title != null && (
        <h3
          className={`text-xl font-semibold mb-3 ${danger ? 'text-red-900' : 'text-foreground'}${titleClassName ? ` ${titleClassName}` : ''}`}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}
