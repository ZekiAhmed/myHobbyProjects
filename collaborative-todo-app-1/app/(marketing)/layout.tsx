/**
 * @fileoverview Marketing shell (Server Component)
 *
 * The public chrome around the landing page: header with section-nav
 * anchors, session-aware auth CTAs, and the footer. Route group for the
 * public root — the dashboard lives at /boards.
 *
 * The shell carries this route's own visual world (route-local tokens
 * in marketing.css, scoped by the .woven wrapper); app surfaces keep
 * their own tokens untouched.
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
import './marketing.css'

export const metadata: Metadata = {
  title: 'Kanify — Collaborative todo app for small teams',
  description:
    'A collaborative Kanify board for small teams. Organize tasks, track progress, and ship work together in real time.',
  openGraph: {
    title: 'Kanify — Collaborative todo app for small teams',
    description:
      'A collaborative Kanify board for small teams. Organize tasks, track progress, and ship work together in real time.',
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
    <div className="woven flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <header className="border-b border-[rgb(244_244_245_/_0.1)] bg-[var(--background)]">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-[15px] font-extrabold tracking-tight text-foreground transition-colors hover:text-[var(--glow)]"
            >
              Kanify
            </Link>
            <nav
              aria-label="Page sections"
              className="hidden items-center gap-6 md:flex"
            >
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="mono text-[11px] tracking-[0.12em] text-zinc-400 uppercase transition-colors hover:text-[var(--glow)]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/boards" />}
                nativeButton={false}
                className="mono h-8 tracking-wide"
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
                  className="mono tracking-wide"
                >
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/sign-up" />}
                  nativeButton={false}
                  className="mono h-8 tracking-wide"
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none flex-1">
        {children}
      </main>

      <footer className="border-t border-[rgb(244_244_245_/_0.1)] bg-[var(--background)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
          <div className="grid gap-10 py-12 md:grid-cols-3">
            <div className="max-w-xs">
              <Link
                href="/"
                className="text-[15px] font-extrabold tracking-tight text-foreground transition-colors hover:text-[var(--glow)]"
              >
                Kanify
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A collaborative todo app for small teams. Organize tasks, track
                progress, and ship work together.
              </p>
            </div>

            <nav aria-label="Footer product links">
              <h2 className="mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                Product
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-[var(--glow)]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="mono text-[11px] tracking-[0.14em] text-zinc-400 uppercase">
                {session ? 'Dashboard' : 'Get started'}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {session ? (
                  <li>
                    <Link
                      href="/boards"
                      className="text-sm text-muted-foreground transition-colors hover:text-[var(--glow)]"
                    >
                      Go to dashboard
                    </Link>
                  </li>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/sign-in"
                        className="text-sm text-muted-foreground transition-colors hover:text-[var(--glow)]"
                      >
                        Sign in
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/sign-up"
                        className="text-sm text-muted-foreground transition-colors hover:text-[var(--glow)]"
                      >
                        Create an account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div className="mono border-t border-[rgb(244_244_245_/_0.1)] py-5 text-[11px] tracking-[0.1em] text-zinc-400 uppercase">
            © {year} Kanify
          </div>
        </div>
      </footer>
    </div>
  )
}
