'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import { describeUserAgent } from '@/lib/user-agent'
import type { ActiveSession } from '@/lib/types'

/**
 * List the acting user's Active sessions for the Account Security tab.
 *
 * Reads Better Auth's own Session store (the prisma `Session` model Better
 * Auth writes through its adapter) — no parallel session store. The query
 * names only the acting user and only non-expired rows, so this entrypoint
 * can never list anyone else's sessions; `isCurrent` marks the row making
 * the call. Session tokens are not returned — revocation is by row id.
 *
 * WHY NOT `auth.api.listSessions`: that endpoint runs Better Auth's
 * fresh-session middleware, which rejects any session older than
 * `freshAge` (default 24h, and this app's sliding session never rewrites
 * `createdAt`). The Security tab would go dark for exactly the long-lived
 * sessions it exists to show. The underlying store is the same either way.
 */
export async function listActiveSessions(): Promise<ActionResult<ActiveSession[]>> {
  try {
    const session = await getRequiredSession()

    const rows = await prisma.session.findMany({
      where: { userId: session.user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    return actionSuccess(
      rows.map((row) => ({
        id: row.id,
        device: describeUserAgent(row.userAgent),
        ip: row.ipAddress || 'Unknown IP',
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        isCurrent: row.id === session.session.id,
      }))
    )
  } catch {
    return actionError('server', 'Failed to load active sessions')
  }
}

/**
 * Revoke one of the acting user's own Active sessions by row id.
 *
 * The delete is scoped to `userId: session.user.id`, so a row belonging to
 * anyone else can never be touched from this entrypoint (a miss reports
 * "Session not found" without revealing whether it exists elsewhere). The
 * current session is rejected up front: it has no revoke control here —
 * nav Sign out already exists.
 */
export async function revokeSession(sessionId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getRequiredSession()

    if (sessionId === session.session.id) {
      return actionError('authorization', 'You cannot revoke your current session')
    }

    const result = await prisma.session.deleteMany({
      where: { id: sessionId, userId: session.user.id },
    })

    if (result.count === 0) {
      return actionError('authorization', 'Session not found')
    }

    revalidateTag('sessions', 'max')
    return actionSuccess({ id: sessionId })
  } catch {
    return actionError('server', 'Failed to sign out session')
  }
}

/**
 * "Sign out all other sessions" — revoke every non-current Active session
 * of the acting user in one call.
 *
 * The where clause names the acting user (never anyone else), excludes the
 * current session by id (you stay signed in), and touches only non-expired
 * rows — the same set the list shows. Returns how many rows went away.
 */
export async function revokeOtherSessions(): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await getRequiredSession()

    const result = await prisma.session.deleteMany({
      where: {
        userId: session.user.id,
        id: { not: session.session.id },
        expiresAt: { gt: new Date() },
      },
    })

    revalidateTag('sessions', 'max')
    return actionSuccess({ count: result.count })
  } catch {
    return actionError('server', 'Failed to sign out other sessions')
  }
}
