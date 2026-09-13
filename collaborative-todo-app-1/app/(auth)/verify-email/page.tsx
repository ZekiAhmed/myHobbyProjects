/**
 * @fileoverview Email Verification Page
 * 
 * This page handles two scenarios:
 * 1. User just signed up - shows "Check your inbox" message
 * 2. User clicked verification link - shows "Email Verified" message
 * 
 * HOW IT WORKS:
 * - When user signs up, they're redirected here
 * - Page checks for a token in the URL
 * - If token exists: User clicked the verification link
 * - If no token: User just signed up, show instructions
 * 
 * VERIFICATION FLOW:
 * 1. User signs up → redirected to /verify-email (no token)
 * 2. Page shows "Check your inbox" message
 * 3. User receives email with link: /verify-email?token=abc123
 * 4. User clicks link → redirected to /verify-email?token=abc123
 * 5. Page shows "Email Verified" message
 * 6. User can now sign in
 * 
 * @see https://better-auth.com/docs/authentication/email-password#email-verification
 */

'use client' // This is a Client Component (uses hooks, browser APIs)

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { sendVerificationEmail } from '@/lib/auth-client'

/**
 * Email Verification Page Component
 * 
 * Uses React hooks for:
 * - Search params (read token from URL)
 * - Form state (email for resend)
 * - UI state (success/error messages, loading)
 */
export default function VerifyEmailPage() {
  // Get the token from URL query parameters
  // Example: /verify-email?token=abc123
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  // Form state
  const [email, setEmail] = useState('')
  
  // UI state
  const [message, setMessage] = useState('') // Success message
  const [error, setError] = useState('') // Error message
  const [loading, setLoading] = useState(false) // Disable form during submission

  /**
   * Handle resend verification email.
   * 
   * WHAT HAPPENS:
   * 1. User enters their email
   * 2. User clicks "Resend verification email"
   * 3. Better Auth sends a new verification email
   * 4. User sees success message
   */
  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    setError('') // Clear previous errors
    setMessage('') // Clear previous success messages
    setLoading(true) // Show loading state

    try {
      // Call Better Auth's sendVerificationEmail method
      const result = await sendVerificationEmail({ email })
      
      if (result.error) {
        // Failed to send email
        setError(result.error.message || 'Failed to send verification email')
      } else {
        // Email sent successfully
        setMessage('Verification email sent! Please check your inbox.')
      }
    } catch (err) {
      // Unexpected error
      setError('An unexpected error occurred')
    } finally {
      // Reset loading state
      setLoading(false)
    }
  }

  /**
   * SCENARIO 1: Token exists in URL
   * 
   * This means the user clicked the verification link in the email.
   * Better Auth validates the token automatically.
   * If valid, the email is marked as verified.
   */
  if (token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Email Verified</h1>
        <p className="text-gray-600 mb-6">
          Your email has been verified successfully!
        </p>
        <Link
          href="/sign-in"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Sign in to your account
        </Link>
      </div>
    )
  }

  /**
   * SCENARIO 2: No token in URL
   * 
   * This means the user just signed up and needs to verify their email.
   * Show instructions and a form to resend the verification email.
   */
  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-6">Check your inbox</h1>
      
      <p className="text-gray-600 text-center mb-6">
        We've sent you a verification email. Please check your inbox and click the link to verify your email address.
      </p>

      {/* Success message (shown after resend) */}
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

      {/* Resend verification email form */}
      <form onSubmit={handleResend} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Didn't receive the email?
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your email to resend"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Show loading text while sending */}
          {loading ? 'Sending...' : 'Resend verification email'}
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
