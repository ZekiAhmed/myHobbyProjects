/**
 * @fileoverview Toast Utility
 *
 * Wraps sonner's toast for consistent notification patterns across the app.
 * Provides specialized handlers for different error types.
 *
 * Patterns:
 * - toast.success(message): Visible confirmation for invisible actions / slow ops
 * - toastValidationError(message): Inline error in forms (returns message, doesn't toast)
 * - toastAuthorizationError(message): Toast with specific permission message
 * - toastNetworkError(message, retry?): Generic toast with optional retry button
 */

import { toast } from 'sonner'

export function handleActionResult<T>(
  result: { success: boolean; error?: { type: string; message: string }; data?: T },
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: { type: string; message: string }) => void
    successMessage?: string
    silentSuccess?: boolean
  }
): void {
  if (result.success) {
    if (options?.onSuccess && result.data) {
      options.onSuccess(result.data as T)
    }
    if (options?.successMessage && !options?.silentSuccess) {
      toast.success(options.successMessage)
    }
  } else if (result.error) {
    if (options?.onError) {
      options.onError(result.error)
    }
    switch (result.error.type) {
      case 'validation':
        break
      case 'authorization':
        toast.error(result.error.message)
        break
      case 'server':
        toast.error(result.error.message, {
          action: {
            label: 'Retry',
            onClick: () => {},
          },
        })
        break
    }
  }
}

export function handleMutationError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'

  if (message.includes('Forbidden') || message.includes('Only the board owner')) {
    toast.error(message)
  } else if (message.includes('not found') || message.includes('Not found')) {
    toast.error(message)
  } else {
    toast.error('Something went wrong. Please try again.', {
      action: {
        label: 'Retry',
        onClick: () => window.location.reload(),
      },
    })
  }
}

export function handleAsyncError(error: unknown, context?: string): void {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  const displayMessage = context ? `${context}: ${message}` : message
  toast.error(displayMessage)
}

export { toast }
