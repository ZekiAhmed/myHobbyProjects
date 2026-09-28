/**
 * @fileoverview Shared platform-role gate for Administrator-only work
 * (subscription-billing review)
 *
 * Every Administrator-only Server Action re-checks the platform role
 * after the session is established — defense in depth behind the
 * /admin page's requireAdmin() gate, so a stale open session that lost
 * the role is refused with an authorization ActionResult instead of a
 * write (spec §Administration).
 *
 * One helper, three callers (role management, pricing settings, payment
 * review): the check must not drift between them, and the per-action
 * refusal message is the only thing that differs. Lives in lib/ rather
 * than a 'use server' file because modules exporting server actions
 * cannot re-export plain helpers (the constraint that first shaped this
 * gate in actions/admin.ts).
 *
 * Route handlers do NOT use this — a fetch caller gets a 403 JSON body
 * from its own inline check, since an ActionResult has no HTTP meaning
 * there.
 */

import { actionError, type ActionResult } from '@/lib/errors'
import { getPlatformRole } from '@/lib/session'

/**
 * @param actorId - The signed-in user's id
 * @param action - What was attempted, phrased to follow
 *   "Only Administrators can …" (e.g. "decide payments")
 * @returns An authorization ActionResult when the actor is not an
 *   Administrator, null when the actor may proceed
 */
export async function refuseUnlessAdministrator(
  actorId: string,
  action: string
): Promise<ActionResult<never> | null> {
  if ((await getPlatformRole(actorId)) !== 'ADMINISTRATOR') {
    return actionError('authorization', `Only Administrators can ${action}`)
  }
  return null
}
