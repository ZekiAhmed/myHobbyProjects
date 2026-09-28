/**
 * @fileoverview Notification emission helpers — build the row payload once
 *
 * Three events emit a Notification today:
 * - assignment (ticket 05) from `createTodo` / `updateTodo`
 * - a new Comment (ticket 06) from `createComment`
 * - a payment approval / rejection (subscription-billing issue 08) from
 *   the Administrator's decide actions
 *
 * All always write inside the SAME `prisma.$transaction` as the domain
 * change, so the bell cannot drift from reality (spec §Notification design).
 *
 * TARGETED-ONLY RULE: a row is addressed to the people who should return to
 * the work — the assignee, or for a Comment the Todo's assignee and each
 * prior commenter — minus the actor and minus duplicate/self rows. Status,
 * membership, tag and rename events, comment edits, and board Owner
 * bystanders persist nothing; nothing is ever broadcast board-wide. A
 * payment decision is addressed to the subscriber alone: it carries no
 * board and no todo (spec story 51), and it is never a Board Activity
 * entry (ADR-0002).
 *
 * Pure module — no server-only imports — so Server Actions and client
 * components can share it.
 */

import type { NotificationType } from '@/lib/generated/prisma/browser'

export type AssignmentEmission = {
  /** The new assignee — the sole recipient of an `ASSIGNED` row. */
  assigneeId: string | null | undefined
  /** Who performed the assignment. */
  actorId: string
  boardId: string
  todoId: string
}

export type CommentEmission = {
  /** The Todo's assignee — notified unless they wrote the new Comment. */
  assigneeId: string | null | undefined
  /** Authors of Comments already on the Todo — the new Comment is not among them. */
  priorCommenterIds: readonly string[]
  /** Who wrote the new Comment — never notified about their own Comment. */
  actorId: string
  boardId: string
  todoId: string
}

export type PaymentDecisionEmission = {
  /** The subscriber being told the outcome of their own payment — the sole recipient. */
  subscriberId: string
  /** The Administrator who made the decision — shown as the actor. */
  actorId: string
  decision: 'APPROVED' | 'REJECTED'
}

/** The exact `data` payload written to the Notification table. */
export type NotificationData = {
  userId: string
  actorId: string
  // the schema enum itself — one source of truth, no hand-kept union to drift
  type: NotificationType
  // nullable: a payment decision belongs to no board and no todo
  boardId: string | null
  todoId: string | null
}

/**
 * Whether an assignment should persist a Notification row.
 *
 * `true` only when the assignment names someone other than the actor —
 * self-assignment and unassignment (`null`) emit nothing. Callers gate
 * further on their own "the assignee actually changed" condition.
 */
export function isAssignedToSomeoneElse(
  assigneeId: string | null | undefined,
  actorId: string
): boolean {
  return typeof assigneeId === 'string' && assigneeId !== actorId
}

/**
 * The `COMMENTED` row payloads for one new Comment — one payload per
 * recipient, in emission order, de-duplicated.
 *
 * Recipients are the Todo's assignee plus every prior commenter, minus the
 * Comment's author (`actorId`): a sole commenter commenting again on their
 * own unassigned Todo yields `[]`, and someone who is both assignee and
 * commenter gets exactly one row. A null assignee is dropped.
 *
 * Pure builder like `assignmentNotificationData`: the caller loops the rows
 * inside its existing transaction and asserts the payloads directly in tests.
 */
export function commentNotifications(entry: CommentEmission): NotificationData[] {
  const recipients = new Set<string>()

  if (typeof entry.assigneeId === 'string') recipients.add(entry.assigneeId)
  for (const commenterId of entry.priorCommenterIds) recipients.add(commenterId)

  recipients.delete(entry.actorId)

  return [...recipients].map((userId) => ({
    userId,
    actorId: entry.actorId,
    type: 'COMMENTED' as const,
    boardId: entry.boardId,
    todoId: entry.todoId,
  }))
}

/**
 * Build the Notification row payload for `tx.notification.create({ data })`.
 *
 * Kept as a pure builder (rather than a function that takes the transaction
 * client) so every call site stays one line inside its existing transaction
 * and the payload is trivially assertable in tests — the same shape
 * `activityData` has for Activity rows.
 */
export function assignmentNotificationData(entry: AssignmentEmission): NotificationData {
  return {
    userId: entry.assigneeId as string,
    actorId: entry.actorId,
    type: 'ASSIGNED',
    boardId: entry.boardId,
    todoId: entry.todoId,
  }
}

/**
 * Build the Notification row payload for one payment decision
 * (subscription-billing issue 08).
 *
 * Addressed to the subscriber alone with the deciding Administrator as
 * actor, and with `boardId`/`todoId` null — a payment decision is not a
 * board-collaboration event, so it exists as a user Notification (and the
 * submission's own metadata), never as a Board Activity entry
 * (ADR-0002, spec story 51). Same pure-builder contract as
 * `assignmentNotificationData`: the caller writes it inside its existing
 * decision transaction.
 */
export function paymentDecisionNotificationData(
  entry: PaymentDecisionEmission
): NotificationData {
  return {
    userId: entry.subscriberId,
    actorId: entry.actorId,
    type: entry.decision === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
    boardId: null,
    todoId: null,
  }
}
