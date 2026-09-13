/**
 * @fileoverview Forgot Password Page
 * 
 * This page allows users to request a password reset email.
 * 
 * PASSWORD RESET FLOW:
 * 1. User enters their email on this page
 * 2. User clicks "Send reset link"
 * 3. Better Auth generates a reset token
 * 4. User receives email with reset link
 * 5. User clicks link → redirected to /reset-password?token=abc123
 * 6. User enters new password on reset-password page
 * 7. Password is updated
 * 8. User can sign in with new password
 * 
 * SECURITY NOTES:
 * - Tokens expire after 1 hour
 * - Tokens are single-use (consumed after reset)
 * - Same success message whether email exists or not (prevents enumeration)
 * 
 * @see https://better-auth.com/docs/authentication/email-password#request-password-reset
 */

'use client' // This is a Client Component (uses hooks, browser APIs)

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

/**
 * Forgot Password Page Component
 * 
 * Uses React hooks for:
 * - Form state (email)
 * - UI state (success/error messages, loading)
 */
export default function ForgotPasswordPage() {
  // Form state
  const [email, setEmail] = useState('')
  
  // UI state
  const [message, setMessage] = useState('') // Success message
  const [error, setError] = useState('') // Error message
  const [loading, setLoading] = useState(false) // Disable form during submission

  /**
   * Handle form submission.
   * 
   * WHAT HAPPENS:
   * 1. Prevent default form submission
   * 2. Clear previous messages
   * 3. Set loading state
   * 4. Call Better Auth's requestPasswordReset
   * 5. Handle success or error
   * 6. Reset loading state
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    setError('') // Clear previous errors
    setMessage('') // Clear previous success messages
    setLoading(true) // Show loading state

    try {
      // Call Better Auth's requestPasswordReset method
      // This generates a reset token and sends an email
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password', // Where to redirect after clicking the link
      })
      
      if (result.error) {
        // Failed to send reset email
        setError(result.error.message || 'Failed to send reset email')
      } else {
        // Email sent successfully
        // Note: Same message whether email exists or not (prevents email enumeration)
        setMessage('Password reset email sent! Please check your inbox.')
      }
    } catch (err) {
      // Unexpected error
      setError('An unexpected error occurred')
    } finally {
      // Reset loading state
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-6">Forgot your password?</h1>
      
      <p className="text-gray-600 text-center mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {/* Success message (shown after sending email) */}
      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {message}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Request password reset form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Show loading text while sending */}
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      {/* Link back to sign-in */}
      <p className="mt-4 text-center text-sm text-gray-600">
        Remember your password?{' '}
        <Link href="/sign-in" className="text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </div>
  )
}
