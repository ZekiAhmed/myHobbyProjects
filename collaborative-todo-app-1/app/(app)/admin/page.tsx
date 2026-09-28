/**
 * @fileoverview Admin Area Page (Server Component)
 *
 * Route: /admin — the platform Administrator area (subscription-billing 01).
 *
 * AUTHORIZATION:
 * requireAdmin() is the single gate: signed-out visitors redirect to
 * /sign-in, and signed-in non-Administrators trigger the forbidden()
 * interrupt, which renders the forbidden boundary with HTTP 403.
 * This is the platform role (payment approval), deliberately distinct
 * from the board Owner role.
 *
 * The area grows with the tickets that hang off this gate: role
 * management (01), pricing/bank-details settings (02), and the payment
 * review queue (07).
 */

import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/db'
import { getPricingSettings } from '@/lib/pricing-settings'
import { PageShell } from '@/components/PageShell'
import { RoleManager } from '@/components/admin/RoleManager'
import { PricingSettingsForm } from '@/components/admin/PricingSettingsForm'
import { ReviewQueue } from '@/components/admin/ReviewQueue'

export default async function AdminPage() {
  const session = await requireAdmin()

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' },
  })

  // Read only after requireAdmin passed: the settings record is
  // Administrator-only. The read never writes — the migration seeds
  // the record, and a missing row falls back to the seed defaults
  // in memory (lib/pricing-settings.ts).
  const settings = await getPricingSettings()

  return (
    <PageShell title="Administration">
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Signed in as {session.user.email}. Platform Administrators review
          subscription payments and manage who holds the Administrator role.
        </p>
        <RoleManager users={users} currentUserId={session.user.id} />
        <PricingSettingsForm settings={settings} />
        {/* Client component: the queue reads through React Query and
            decides through server actions (subscription-billing 07).
            The whole page sits behind requireAdmin, and the route plus
            both actions re-check the role anyway. */}
        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">Payment review queue</h2>
          <p className="text-sm text-muted-foreground">
            Pending payments, oldest first. Approve starts or extends the
            subscriber&apos;s paid period; rejection needs a reason.
          </p>
          <div className="mt-3">
            <ReviewQueue />
          </div>
        </section>
      </div>
    </PageShell>
  )
}
