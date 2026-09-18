/**
 * @fileoverview Error Types and Utilities
 *
 * Defines the structured error response pattern for Server Actions.
 * All Server Actions return { success: true, data } or { success: false, error }.
 *
 * Error types:
 * - validation: Client input errors (inline in forms)
 * - authorization: Permission errors (toast with specific message)
 * - server: Network/database errors (generic toast with retry)
 */

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
  }
}

export type ActionResult<T> = ActionSuccess<T> | ActionError

export function actionSuccess<T>(data: T): ActionSuccess<T> {
  return { success: true, data }
}

export function actionError(type: ErrorType, message: string): ActionError {
  return { success: false, error: { type, message } }
}

export function isActionError<T>(result: ActionResult<T>): result is ActionError {
  return !result.success
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected error occurred'
}
