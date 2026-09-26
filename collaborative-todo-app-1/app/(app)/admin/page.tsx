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
 * The area starts minimal: the user list with in-app promote/demote
 * controls (RoleManager). Later tickets hang the review queue and the
 * pricing/bank-details settings off this gate.
 */

import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/db'
import { PageShell } from '@/components/PageShell'
import { RoleManager } from '@/components/admin/RoleManager'

export default async function AdminPage() {
  const session = await requireAdmin()

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <PageShell title="Administration">
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Signed in as {session.user.email}. Platform Administrators review
          subscription payments and manage who holds the Administrator role.
        </p>
        <RoleManager users={users} currentUserId={session.user.id} />
        <section className="rounded-lg border p-4">
          <h2 className="font-semibold">Payment review queue</h2>
          <p className="text-sm text-muted-foreground">
            Pending payment submissions will appear here.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
