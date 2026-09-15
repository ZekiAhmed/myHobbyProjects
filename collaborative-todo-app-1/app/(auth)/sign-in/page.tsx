/**
 * @fileoverview Sign-In Page
 * 
 * This page allows existing users to sign in with email and password.
 * 
 * WHAT THIS PAGE DOES:
 * 1. Displays a form with email and password fields
 * 2. Validates input (required fields)
 * 3. Calls Better Auth's signIn.email() to authenticate
 * 4. Redirects to callbackUrl on success (or / by default)
 * 5. Shows error message on failure
 * 
 * CALLBACK URL:
 * - When a user tries to access a protected page, they're redirected to /sign-in
 * - The original URL is saved as a query parameter: /sign-in?callbackUrl=/boards/abc123
 * - After successful sign-in, user is redirected back to the original URL
 * - This provides better UX (user ends up where they wanted to go)
 * 
 * @see https://better-auth.com/docs/authentication/email-password
 */

'use client' // This is a Client Component (uses hooks, browser APIs)

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, authClient } from '@/lib/auth-client'

/**
 * Sign-In Page Component
 * 
 * Uses React hooks for:
 * - Form state management (email, password)
 * - Error handling (error message)
 * - Loading state (disable form during submission)
 * - Navigation (redirect after sign-in)
 * - Search params (read callbackUrl from URL)
 */
export default function SignInPage() {
  // Router for programmatic navigation after sign-in
  const router = useRouter()
  
  // Get the callbackUrl from the URL query parameters
  // Example: /sign-in?callbackUrl=/boards/abc123
  // searchParams.get('callbackUrl') returns '/boards/abc123'
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // UI state
  const [error, setError] = useState('') // Error message to display
  const [loading, setLoading] = useState(false) // Disable form during submission

  // Redirect authenticated users away from sign-in page
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await authClient.getSession()
      if (data?.session) {
        router.push(callbackUrl)
      }
    }
    checkSession()
  }, [router, callbackUrl])

  /**
   * Handle form submission.
   * 
   * WHAT HAPPENS:
   * 1. Prevent default form submission (page reload)
   * 2. Clear any previous errors
   * 3. Set loading state
   * 4. Call Better Auth's signIn.email()
   * 5. Handle success or error
   * 6. Reset loading state
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    setError('') // Clear previous errors
    setLoading(true) // Show loading state

    try {
      // Call Better Auth's sign-in method
      // This validates credentials and creates a session
      const result = await signIn.email({
        email,
        password,
      })

      // Check if sign-in was successful
      if (result.error) {
        // Sign-in failed - show error message
        const errorMessage = result.error.message || 'Failed to sign in'
        
        // Special handling for unverified email
        // Better Auth returns a specific error message for this case
        if (errorMessage.includes('verified')) {
          setError('Please verify your email address before signing in')
        } else {
          setError(errorMessage)
        }
      } else {
        // Sign-in successful - redirect to callbackUrl or default to /boards
        router.push(callbackUrl)
      }
    } catch (err) {
      // Unexpected error (network issue, server error, etc.)
      setError('An unexpected error occurred')
    } finally {
      // Reset loading state regardless of success/failure
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-6">Sign in to your account</h1>
      
      {/* Error message display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email field */}
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

        {/* Password field */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your password"
          />
        </div>

        {/* Forgot password link */}
        <div className="flex items-center justify-between">
          <Link
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Show loading text while submitting */}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Link to sign-up page */}
      <p className="mt-4 text-center text-sm text-gray-600">
        Don't have an account?{' '}
        <Link href="/sign-up" className="text-blue-600 hover:text-blue-500">
          Sign up
        </Link>
      </p>
    </div>
  )
}
