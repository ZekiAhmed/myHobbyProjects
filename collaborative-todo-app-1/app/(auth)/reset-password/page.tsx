/**
 * @fileoverview Reset Password Page
 * 
 * This page allows users to set a new password using a reset token.
 * 
 * HOW USERS GET HERE:
 * 1. User clicks "Forgot password?" on sign-in page
 * 2. User enters their email on forgot-password page
 * 3. User receives email with reset link
 * 4. User clicks link → redirected to /reset-password?token=abc123
 * 5. This page validates the token and shows the password form
 * 
 * TOKEN VALIDATION:
 * - If token is missing: Show "Invalid Reset Link" message
 * - If token is valid: Show password form
 * - If token is expired/invalid: Better Auth returns an error
 * 
 * SECURITY NOTES:
 * - Tokens expire after 1 hour
 * - Tokens are single-use (consumed after reset)
 * - Password must be at least 12 characters
 * - User must confirm password (prevents typos)
 * 
 * @see https://better-auth.com/docs/authentication/email-password#reset-password
 */

'use client' // This is a Client Component (uses hooks, browser APIs)

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

/**
 * Reset Password Page Component
 * 
 * Uses React hooks for:
 * - Router (redirect after successful reset)
 * - Search params (read token from URL)
 * - Form state (password, confirmPassword)
 * - UI state (error message, loading)
 */
export default function ResetPasswordPage() {
  // Router for programmatic navigation after reset
  const router = useRouter()
  
  // Get the token from URL query parameters
  // Example: /reset-password?token=abc123
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  // Form state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // UI state
  const [error, setError] = useState('') // Error message
  const [loading, setLoading] = useState(false) // Disable form during submission

  /**
   * SCENARIO: No token in URL
   * 
   * This means:
   * - User accessed the page directly (not via email link)
   * - Token is missing from the URL
   * - Link is invalid
   * 
   * Show error message and link to request a new reset link
   */
  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
        <p className="text-gray-600 mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Request a new reset link
        </Link>
      </div>
    )
  }

  /**
   * Handle form submission.
   * 
   * WHAT HAPPENS:
   * 1. Prevent default form submission
   * 2. Validate passwords match
   * 3. Validate password length
   * 4. Set loading state
   * 5. Call Better Auth's resetPassword
   * 6. Handle success or error
   * 7. Reset loading state
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    setError('') // Clear previous errors

    // Client-side validation: passwords must match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Client-side validation: password must be at least 12 characters
    if (password.length < 12) {
      setError('Password must be at least 12 characters')
      return
    }

    setLoading(true) // Show loading state

    try {
      // Call Better Auth's resetPassword method
      // This validates the token and updates the password
      const result = await authClient.resetPassword({
        newPassword: password,
        token, // The token from the URL
      })

      if (result.error) {
        // Reset failed (token expired, invalid, etc.)
        setError(result.error.message || 'Failed to reset password')
      } else {
        // Reset successful - redirect to sign-in with success message
        router.push('/sign-in?message=Password reset successful')
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
      <h1 className="text-2xl font-bold text-center mb-6">Reset your password</h1>
      
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Reset password form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter new password (min 12 characters)"
          />
        </div>

        {/* Confirm password field */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm new password"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Show loading text while resetting */}
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      {/* Link back to sign-in */}
      <p className="mt-4 text-center text-sm text-gray-600">
        <Link href="/sign-in" className="text-blue-600 hover:text-blue-500">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
