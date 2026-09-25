/**
 * @fileoverview Activity emission helpers — write one Activity row with the domain change
 *
 * Every mutation inside the ADR-0002 taxonomy emits its Activity row in the
 * SAME `prisma.$transaction` as the domain write, so the feed cannot drift
 * from reality (spec §Activity emission). Mutations outside the taxonomy emit
 * nothing.
 *
 * SERVER-ONLY: reads `next/headers` for the best-effort IP.
 *
 * RESOURCE CONVENTIONS (resourceType / resourceId are compliance columns —
 * ADR-0002):
 * - `board.renamed`                → BOARD / boardId
 * - `member.invited`               → INVITATION / invitation id (the artifact created)
 * - `member.joined|removed|left`   → USER / the affected member's id — it stays
 *   resolvable after the BoardMember row itself is deleted
 * - `todo.*`                       → TODO / todo id. On `todo.deleted` the id IS
 *   the record: the row is gone by design and BOARD/boardId would only repeat
 *   the entry's own boardId.
 * - `tag.created|deleted`          → TAG / tag id (same reasoning on delete)
 * - `comment.created`              → COMMENT / comment id (the row still exists)
 * - `comment.deleted`              → TODO / todo id (the Comment row is
 *   hard-deleted — decided in issue 03)
 *
 * @see docs/adr/0002-activity-log-user-feed-not-audit-trail.md
 */

import { headers } from 'next/headers'
import type { ActivityAction } from '@/lib/activity-labels'

export type ActivityEmission = {
  boardId: string
  /** `null` is legal: the actor's account may be erased later (`SetNull`). */
  actorId: string | null
  action: ActivityAction
  resourceType: string
  resourceId: string
  ipAddress?: string | null
}

/** The exact `data` payload written to the Activity table. */
export type ActivityData = {
  boardId: string
  actorId: string | null
  action: ActivityAction
  resourceType: string
  resourceId: string
  ipAddress: string | null
}

/**
 * Build the Activity row payload for `tx.activity.create({ data: ... })`.
 *
 * Kept as a pure builder (rather than a function that takes the transaction
 * client) so every call site stays one line inside its existing transaction
 * and the payload is trivially assertable in tests.
 */
export function activityData(entry: ActivityEmission): ActivityData {
  return {
    boardId: entry.boardId,
    actorId: entry.actorId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    ipAddress: entry.ipAddress ?? null,
  }
}

/**
 * Best-effort client IP for the compliance column — never throws.
 *
 * Returns the first `x-forwarded-for` hop, else `x-real-ip`, else null
 * (the column is nullable: a missing IP must not fail the domain write).
 */
export async function getBestEffortIp(): Promise<string | null> {
  try {
    const requestHeaders = await headers()
    return (
      requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      requestHeaders.get('x-real-ip') ||
      null
    )
  } catch {
    return null
  }
}
