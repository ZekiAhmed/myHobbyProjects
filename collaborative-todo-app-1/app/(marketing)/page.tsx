/**
 * @fileoverview Public Landing Page (Server Component)
 *
 * Route: / — the public root of the site. The dashboard lives at /boards.
 *
 * Uses getOptionalSession() so the CTA branches on auth state:
 * - Signed out → "Get started" (sign up)
 * - Signed in → "Go to dashboard" (/boards)
 *
 * This is the intended use of getOptionalSession documented in lib/session.ts.
 */

import Link from 'next/link'
import { getOptionalSession } from '@/lib/session'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    title: 'Boards for every project',
    description:
      'Create a Kanban board per project and organize work into columns that match how your team actually ships.',
  },
  {
    title: 'Real-time collaboration',
    description:
      'Invite your teammates and watch cards move as everyone works — no refresh, no merge conflicts.',
  },
  {
    title: 'Invite links that just work',
    description:
      'Share a single link and collaborators are in. Roles and permissions keep the right people in control.',
  },
] as const

export default async function LandingPage() {
  const session = await getOptionalSession()

  return (
    <div className="container mx-auto px-4 md:px-6">
      <section className="flex flex-col items-center gap-6 py-20 text-center md:py-28">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Plan, track, and ship together
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Kanban is a collaborative todo board for small teams. Organize tasks,
          see progress at a glance, and get work across the finish line.
        </p>
        <div className="flex items-center gap-3">
          {session ? (
            <Button
              size="lg"
              render={<Link href="/boards" />}
              nativeButton={false}
            >
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                render={<Link href="/sign-up" />}
                nativeButton={false}
              >
                Get started
              </Button>
              <Button
                variant="outline"
                size="lg"
                render={<Link href="/sign-in" />}
                nativeButton={false}
              >
                Sign in
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 pb-20 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl bg-background p-6 ring-1 ring-foreground/10"
          >
            <h2 className="text-base font-semibold text-foreground">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
