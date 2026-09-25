/**
 * @fileoverview Notification emission helpers — build the row payload once
 *
 * Assignment is the only event that emits a Notification today (ticket 05),
 * and it emits from two entrypoints — `createTodo` (created already assigned)
 * and `updateTodo` (assignee change) — always inside the SAME
 * `prisma.$transaction` as the assignment write, so the bell cannot drift
 * from reality (spec §Notification design).
 *
 * TARGETED-ONLY RULE: a row is addressed to the new assignee alone.
 * Self-assignment, unassignment, and every non-assignment event (status,
 * membership, tags, rename, comment …) persist nothing; board Owner and
 * other members are never bystander recipients.
 *
 * Pure module — no server-only imports — so Server Actions and client
 * components can share it.
 */

export type AssignmentEmission = {
  /** The new assignee — the sole recipient of an `ASSIGNED` row. */
  assigneeId: string | null | undefined
  /** Who performed the assignment. */
  actorId: string
  boardId: string
  todoId: string
}

/** The exact `data` payload written to the Notification table. */
export type NotificationData = {
  userId: string
  actorId: string
  type: 'ASSIGNED'
  boardId: string
  todoId: string
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
