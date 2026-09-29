/**
 * @fileoverview Board write lock — the server-side read of the derived
 * expiry lock (subscription-billing issue 09)
 *
 * The rule itself is pure (lib/subscription.ts → deriveBoardWriteLock);
 * this module is the server-side seam that reads the Owner's period end
 * and the Board's member count off the database and turns the rule into
 * a refusal, so the rule is applied one way in every Server Action.
 *
 * NOTHING IS STORED. The lock is derived at read/write time from the
 * Owner's `subscriptionPeriodEnd` — no cron, no grace period, no flag to
 * forget to clear. Data is never deleted or hidden: only writes are
 * refused, so a locked Board stays fully viewable (spec §Domain &
 * entitlement).
 *
 * Reads are deliberately NOT gated here: GET routes and Server
 * Components must keep serving a locked Board in full — the board page
 * derives the same lock to withdraw the UI's write affordances.
 */

import { prisma } from '@/lib/db'
import { actionError, type ActionError } from '@/lib/errors'
import {
  deriveBoardWriteLock,
  type BoardWriteLock,
  type BoardWriteLockReason,
} from '@/lib/subscription'

/** User-facing refusal for each reason the Board can be locked. */
const LOCK_MESSAGES: Record<BoardWriteLockReason, string> = {
  expired:
    "This board is read-only — the Owner's subscription has expired. Renew to restore editing.",
  none: 'This board is read-only — Boards with Members need an active Pro subscription.',
}

/** The message a locked Board shows whoever tried to write to it. */
export function boardLockMessage(reason: BoardWriteLockReason): string {
  return LOCK_MESSAGES[reason]
}

/**
 * The refusal every write guard returns once a Board has locked, or
 * null when it is still writable.
 */
function refusalForLock(lock: BoardWriteLock): ActionError | null {
  return lock.locked && lock.reason
    ? actionError('authorization', boardLockMessage(lock.reason))
    : null
}

/**
 * Derives the lock from an already-loaded Board row: the Owner's
 * relation carries `subscriptionPeriodEnd`, `_count.members` says whether
 * this is a team Board. Absent fields degrade the way the rule itself
 * would: a missing member count reads as a solo Board (never locked),
 * a missing Owner period reads as never-subscribed (locked as `none`
 * once Members are counted).
 */
export function deriveBoardWriteLockForRow(
  board: {
    owner?: { subscriptionPeriodEnd: Date | null } | null
    _count?: { members: number } | null
  } | null,
  now: Date = new Date()
): BoardWriteLock & { periodEnd: Date | null } {
  const ownerPeriodEnd = board?.owner?.subscriptionPeriodEnd ?? null
  const hasMembers = (board?._count?.members ?? 0) > 0

  return {
    ...deriveBoardWriteLock({ hasMembers, ownerPeriodEnd, now }),
    periodEnd: ownerPeriodEnd,
  }
}

/** One narrow read: the Owner's period end plus the member count. */
const lockRowSelect = {
  owner: { select: { subscriptionPeriodEnd: true } },
  _count: { select: { members: true } },
} as const

/**
 * The guard every mutating Server Action calls: an authorization
 * refusal when the Board is locked for writing, or null when it is
 * writable (and the action carries on).
 */
export async function boardLockedError(
  boardId: string,
  now: Date = new Date()
): Promise<ActionError | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: lockRowSelect,
  })

  if (!board) return null

  return refusalForLock(deriveBoardWriteLockForRow(board, now))
}

/**
 * Membership result in the shape the write actions already consume:
 * either a refusal (return it straight out as the ActionResult) or the
 * caller's ownership flag with no error.
 */
export type BoardMembershipCheck = ActionError | { isOwner: boolean; error: null }

/**
 * Board membership AND writability in one read — the check every
 * Todo/Comment write runs before it mutates.
 *
 * Order matters: membership first (a stranger is told they are not a
 * member, never that the Board is locked), writability second.
 */
export async function verifyBoardMembership(
  boardId: string,
  userId: string,
  now: Date = new Date()
): Promise<BoardMembershipCheck> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, ...lockRowSelect },
  })

  if (!board) return actionError('server', 'Board not found')

  const isOwner = board.ownerId === userId

  if (!isOwner) {
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId },
    })
    if (!membership) {
      return actionError('authorization', 'You are not a member of this board')
    }
  }

  const refusal = refusalForLock(deriveBoardWriteLockForRow(board, now))

  return refusal ?? { isOwner, error: null }
}

/**
 * Board ownership AND writability in one read — the check the Tag
 * actions run (tags are Owner-only even when the Board is writable).
 */
export async function verifyBoardOwnership(
  boardId: string,
  userId: string,
  now: Date = new Date()
): Promise<ActionError | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, ...lockRowSelect },
  })

  if (!board) return actionError('server', 'Board not found')
  if (board.ownerId !== userId) {
    return actionError('authorization', 'Only the board owner can manage tags')
  }

  return refusalForLock(deriveBoardWriteLockForRow(board, now))
}
