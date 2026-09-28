/**
 * @fileoverview Billing history page (Server Component)
 * (subscription-billing issue 06)
 *
 * Route: /billing — the durable record of every payment attempt
 * (spec story 14): status, timestamps, amount, and reference for each
 * attempt, newest first, plus the 24-hour review promise.
 *
 * The page owns only the session gate and the shell; the table itself
 * is a client component that reads GET /api/billing/submissions through
 * the central query options (spec §Conventions: reads are GET route
 * handlers consumed via React Query), so it shares one cache entry with
 * the dashboard's pending-review banner. The history is self-scoped:
 * a team Member only ever sees their own attempts (story 17).
 */

import { getRequiredSession } from '@/lib/session'
import { PageShell } from '@/components/PageShell'
import { BillingHistory } from '@/components/subscription/BillingHistory'

export default async function BillingHistoryPage() {
  await getRequiredSession()

  return (
    <PageShell title="Billing history">
      <BillingHistory />
    </PageShell>
  )
}
