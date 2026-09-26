'use client'

/**
 * @fileoverview In-app platform role management (subscription-billing 01)
 *
 * Rendered ONLY inside the /admin gate (requireAdmin) — the server actions
 * re-check the actor's role anyway (defense in depth: an open session that
 * lost the role is refused with an authorization ActionResult, not a write).
 *
 * UX contract:
 * - Regular users get Promote, other Administrators get Demote
 * - Your own row never offers Demote (the server refuses self-demotion;
 *   the UI doesn't set up the failure)
 * - Refusals from the server surface as error toasts and leave the list
 *   as-is (router.refresh only runs on success)
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { promoteAdministrator, demoteAdministrator } from '@/actions/admin'

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: 'REGULAR' | 'ADMINISTRATOR'
}

interface RoleManagerProps {
  users: AdminUserRow[]
  currentUserId: string
}

export function RoleManager({ users, currentUserId }: RoleManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function runAction(kind: 'promote' | 'demote', userId: string) {
    startTransition(async () => {
      try {
        const result =
          kind === 'promote'
            ? await promoteAdministrator(userId)
            : await demoteAdministrator(userId)

        if (result.success) {
          toast.success(
            kind === 'promote'
              ? 'User promoted to Administrator'
              : 'Administrator demoted'
          )
          router.refresh()
        } else {
          toast.error(result.error.message)
        }
      } catch {
        toast.error(
          kind === 'promote' ? 'Failed to promote user' : 'Failed to demote user'
        )
      }
    })
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">Users</h2>
      <p className="text-sm text-muted-foreground">
        Platform roles. Administrators review subscription payments and manage
        who holds the role.
      </p>
      <ul className="mt-3 space-y-2">
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const isAdministrator = user.role === 'ADMINISTRATOR'

          return (
            <li
              key={user.id}
              className="flex items-center justify-between rounded-md border p-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {user.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {isAdministrator ? 'Administrator' : 'Regular user'}
                  </span>
                  {isSelf && (
                    <span className="ml-2 text-xs text-muted-foreground">You</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>

              {!isSelf && (
                <Button
                  size="sm"
                  variant={isAdministrator ? 'destructive' : 'default'}
                  disabled={isPending}
                  onClick={() =>
                    runAction(isAdministrator ? 'demote' : 'promote', user.id)
                  }
                >
                  {isAdministrator ? 'Demote' : 'Promote'}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
