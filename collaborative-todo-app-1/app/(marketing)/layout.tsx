/**
 * @fileoverview Marketing shell (Server Component)
 *
 * The public chrome around the landing page: header with section-nav
 * anchors, session-aware auth CTAs, and the footer. Route group for the
 * public root — the dashboard lives at /boards.
 *
 * Async because getOptionalSession() branches the header/footer CTAs on
 * auth state (signed out → Sign in / Get started; signed in → Go to
 * dashboard). Same pattern documented in lib/session.ts and used by
 * app/(marketing)/page.tsx.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getOptionalSession } from '@/lib/session'
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

/** In-page destinations — one landing page, so bare anchors are correct. */
const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
] as const

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getOptionalSession()
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-12 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
            >
              Kanban
            </Link>
            <nav
              aria-label="Page sections"
              className="hidden items-center gap-4 md:flex"
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Button
                size="sm"
                render={<Link href="/boards" />}
                nativeButton={false}
              >
                Go to dashboard
              </Button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid gap-8 py-10 md:grid-cols-3">
            <div className="max-w-xs">
              <Link
                href="/"
                className="text-sm font-semibold text-foreground transition-colors hover:text-muted-foreground"
              >
                Kanban
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                A collaborative todo app for small teams. Organize tasks, track
                progress, and ship work together.
              </p>
            </div>

            <nav aria-label="Footer product links">
              <h2 className="text-sm font-semibold text-foreground">
                Product
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {session ? 'Dashboard' : 'Get started'}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {session ? (
                  <li>
                    <Link
                      href="/boards"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Go to dashboard
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/sign-in"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/sign-up"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Create an account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t py-4 text-xs text-muted-foreground">
            © {year} Kanban
          </div>
        </div>
      </footer>
    </div>
  )
}
