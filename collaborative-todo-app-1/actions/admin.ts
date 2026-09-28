/**
 * @fileoverview Platform role Server Actions (subscription-billing 01)
 *
 * The platform Administrator role is distinct from the board Owner role
 * (CONTEXT.md bans "admin" for board roles). Administrators approve
 * payments in the admin area; they can also promote/demote each other
 * in-app. The very first Administrator is bootstrapped by the one-time
 * scripts/promote-first-admin.mjs — afterwards every change goes through
 * these actions.
 *
 * Demotion guards run inside ONE transaction (spec: an Administrator
 * cannot demote themselves, and the instance can never be left without
 * an Administrator).
 */

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession, getPlatformRole } from '@/lib/session'
import {
  actionSuccess,
  actionError,
  GuardError,
  type ActionResult,
} from '@/lib/errors'

const ADMIN_ROLE = 'ADMINISTRATOR'
const REGULAR_ROLE = 'REGULAR'

/**
 * Shared authorization gate for both role mutations: only an
 * Administrator may manage roles.
 *
 * @returns An authorization ActionResult when the actor is not an
 *   Administrator, null when the actor is allowed to proceed
 */
async function refuseUnlessAdministrator(
  actorId: string
): Promise<ActionResult<never> | null> {
  if ((await getPlatformRole(actorId)) !== ADMIN_ROLE) {
    return actionError('authorization', 'Only Administrators can manage roles')
  }
  return null
}

/**
 * Promotes a user to platform Administrator (Administrators only).
 *
 * Refuses silently-dangerous states as validation errors: an unknown
 * target, or someone who is already an Administrator.
 *
 * @param targetUserId - The user to promote
 */
export async function promoteAdministrator(
  targetUserId: string
): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await getRequiredSession()

    const denied = await refuseUnlessAdministrator(session.user.id)
    if (denied) return denied

    const targetRole = await getPlatformRole(targetUserId)
    if (targetRole === null) {
      return actionError('validation', 'User not found')
    }
    if (targetRole === ADMIN_ROLE) {
      return actionError('validation', 'User is already an Administrator')
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: { role: ADMIN_ROLE },
    })

    return actionSuccess({ userId: targetUserId })
  } catch {
    return actionError('server', 'Failed to promote user')
  }
}

/**
 * Demotes a platform Administrator back to a regular user
 * (Administrators only).
 *
 * GUARDS (all inside one transaction):
 * 1. Self-demotion is refused — nobody can lock themselves out by accident
 * 2. The target must be an Administrator
 * 3. The last remaining Administrator can never be demoted, so the
 *    instance always keeps someone able to approve payments
 *
 * @param targetUserId - The Administrator to demote
 */
export async function demoteAdministrator(
  targetUserId: string
): Promise<ActionResult<{ userId: string }>> {
  try {
    const session = await getRequiredSession()
    const actorId = session.user.id

    const denied = await refuseUnlessAdministrator(actorId)
    if (denied) return denied

    await prisma.$transaction(
      async (tx) => {
        if (targetUserId === actorId) {
          throw new GuardError('authorization', 'You cannot demote yourself')
        }

        const targetRole = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { role: true },
        })
        if (!targetRole) {
          throw new GuardError('validation', 'User not found')
        }
        if (targetRole.role !== ADMIN_ROLE) {
          throw new GuardError('validation', 'User is not an Administrator')
        }

        const administratorCount = await tx.user.count({
          where: { role: ADMIN_ROLE },
        })
        if (administratorCount <= 1) {
          throw new GuardError(
            'validation',
            'At least one Administrator must remain'
          )
        }

        await tx.user.update({
          where: { id: targetUserId },
          data: { role: REGULAR_ROLE },
        })
      },
      // Serializable, not the Postgres default READ COMMITTED: at READ
      // COMMITTED two Administrators demoting each other concurrently both
      // read count=2, both pass the last-admin guard, and the instance is
      // left with zero Administrators. Serializable forces one of the two
      // conflicting transactions to abort instead (surfaced as a server
      // error — retryable).
      { isolationLevel: 'Serializable' }
    )

    return actionSuccess({ userId: targetUserId })
  } catch (error) {
    if (error instanceof GuardError) {
      return actionError(error.kind, error.message)
    }
    return actionError('server', 'Failed to demote user')
  }
}
