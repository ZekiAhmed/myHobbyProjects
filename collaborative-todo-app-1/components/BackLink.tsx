/**
 * @fileoverview Shared leading back link
 *
 * The arrow link that heads secondary pages (board settings, account
 * settings, activity): a muted icon-only Link with a hover wash,
 * labelled for screen readers by destination — "Back to boards", not
 * "back arrow".
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface BackLinkProps {
  href: string
  /** Accessible name — names the destination, not the icon */
  label: string
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="-ml-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={label}
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  )
}
