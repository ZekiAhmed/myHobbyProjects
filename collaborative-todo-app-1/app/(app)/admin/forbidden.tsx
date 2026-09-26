/**
 * @fileoverview Forbidden boundary for the admin area (403 UI)
 *
 * Rendered when requireAdmin() triggers the forbidden() interrupt — i.e.
 * a signed-in user who is not a platform Administrator tried to open
 * /admin. Next.js serves this with an HTTP 403 status.
 */

import Link from 'next/link'

export default function Forbidden() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">Forbidden</h1>
      <p className="mt-3 text-muted-foreground">
        This area is limited to platform Administrators.
      </p>
      <Link
        href="/boards"
        className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Back to boards
      </Link>
    </main>
  )
}
