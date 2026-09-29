/**
 * @fileoverview Error Types and Utilities
 *
 * Defines the structured error response pattern for Server Actions.
 * All Server Actions return { success: true, data } or { success: false, error }.
 *
 * Error types:
 * - validation: Client input errors (inline in forms)
 * - authorization: Permission errors (toast with specific message) —
 *   except a paywall refusal, which carries a `reason` and is shown as
 *   a prompt instead (see below)
 * - server: Network/database errors (generic toast with retry)
 *
 * A paywall refusal is an authorization error that additionally carries
 * a `reason` ('none' | 'expired'), so the client can show the upgrade
 * or renew PROMPT instead of a generic toast (subscription-billing
 * issue 10).
 */

import type { NotProReason } from '@/lib/subscription'

export type ErrorType = 'validation' | 'authorization' | 'server'

export interface ActionSuccess<T> {
  success: true
  data: T
}

export interface ActionError {
  success: false
  error: {
    type: ErrorType
    message: string
    /** Present only on a paywall refusal: which prompt to show. */
    reason?: NotProReason
  }
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { success: true, data }
}

export function actionError(type: ErrorType, message: string): ActionError {
  return { success: false, error: { type, message } }
}

/**
 * The paywall refusal: an authorization error that also names WHY the
 * caller is not Pro, so the client can pair the message with the
 * self-service prompt for that reason (never-subscribed ⇒ upgrade,
 * lapsed ⇒ renew) rather than a generic error toast.
 */
export function paywallError(reason: NotProReason, message: string): ActionError {
  return { success: false, error: { type: 'authorization', message, reason } }
}

export function isActionError<T>(result: ActionResult<T>): result is ActionError {
  return !result.success
}

/**
 * Signals a domain guard refusal raised inside a Server Action's
 * transaction, so the catch block can surface it verbatim (original
 * ErrorType + message) instead of collapsing it into a generic server
 * error. Thrown by the role-demotion guard (actions/admin.ts) and the
 * one-attempt-at-a-time subscribe guard (actions/subscribe.ts).
 */
export class GuardError extends Error {
  constructor(
    public readonly kind: ErrorType,
    message: string
  ) {
    super(message)
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
