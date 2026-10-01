import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/QueryProvider'
import { getRequiredSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { AppNav } from '@/components/AppNav'
import { PendingReviewBanner } from '@/components/subscription/PendingReviewBanner'
import { ExpiryWarningBanner } from '@/components/subscription/ExpiryWarningBanner'

export const metadata: Metadata = {
  title: 'Kanify',
  description: 'A collaborative Kanify todo app for small teams.',
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getRequiredSession()

  const subscriber = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionPeriodEnd: true },
  })

  // AppNav must live inside QueryProvider: the global Notification bell it
  // renders reads TanStack Query (badge + dropdown poll). The pending-review
  // banner reads the same provider (subscription-billing issue 06) and
  // mounts here, under the nav, so the subscriber sees their under-review
  // submission on the dashboard and every other app page — non-blocking,
  // never shown to a team Member (it only ever renders the acting user's
  // own PENDING attempt).
  //
  // The T-7 expiry warning (subscription-billing issue 11) is the shell's
  // second banner, derived server-side from the signed-in user's OWN
  // period end (read above): a team Member has none, so the countdown
  // never reaches them, and an Owner's expiry never leaks to anyone else.
  // One primary-key read per render; the "within 7 days?" decision
  // happens in the component, so there is no stored warning and no cron
  // (spec §Domain & entitlement).
  return (
    <QueryProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <AppNav email={session.user.email} />
      <PendingReviewBanner />
      <ExpiryWarningBanner periodEnd={subscriber?.subscriptionPeriodEnd ?? null} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
    </QueryProvider>
  )
}
