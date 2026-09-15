/**
 * @fileoverview Sign-Up Page
 * 
 * This page allows new users to create an account with email and password.
 * 
 * WHAT THIS PAGE DOES:
 * 1. Displays a form with name, email, and password fields
 * 2. Validates input (required fields, password length)
 * 3. Shows password strength indicator
 * 4. Calls Better Auth's signUp.email() to create the account
 * 5. Redirects to /verify-email on success
 * 6. Shows error message on failure
 * 
 * FLOW:
 * 1. User fills out the form
 * 2. User clicks "Sign up"
 * 3. Account is created (unverified)
 * 4. User is redirected to /verify-email
 * 5. User receives verification email
 * 6. User clicks link in email
 * 7. Email is verified
 * 8. User can now sign in
 * 
 * @see https://better-auth.com/docs/authentication/email-password
 */

'use client' // This is a Client Component (uses hooks, browser APIs)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp, authClient } from '@/lib/auth-client'

/**
 * Sign-Up Page Component
 * 
 * Uses React hooks for:
 * - Form state management (email, password, name)
 * - Error handling (error message)
 * - Loading state (disable form during submission)
 * - Navigation (redirect after sign-up)
 */
export default function SignUpPage() {
  // Router for programmatic navigation after sign-up
  const router = useRouter()
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  
  // UI state
  const [error, setError] = useState('') // Error message to display
  const [loading, setLoading] = useState(false) // Disable form during submission

  // Redirect authenticated users away from sign-up page
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await authClient.getSession()
      if (data?.session) {
        router.push('/')
      }
    }
    checkSession()
  }, [router])

  /**
   * Handle form submission.
   * 
   * WHAT HAPPENS:
   * 1. Prevent default form submission (page reload)
   * 2. Clear any previous errors
   * 3. Set loading state
   * 4. Call Better Auth's signUp.email()
   * 5. Handle success or error
   * 6. Reset loading state
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    setError('') // Clear previous errors
    setLoading(true) // Show loading state

    try {
      // Call Better Auth's sign-up method
      // This creates the user in the database and sends a verification email
      const result = await signUp.email({
        email,
        password,
        name,
      })

      // Check if sign-up was successful
      if (result.error) {
        // Sign-up failed - show error message
        setError(result.error.message || 'Failed to create account')
      } else {
        // Sign-up successful - redirect to verification page
        router.push('/verify-email')
      }
    } catch (err) {
      // Unexpected error (network issue, server error, etc.)
      setError('An unexpected error occurred')
    } finally {
      // Reset loading state regardless of success/failure
      setLoading(false)
    }
  }

  /**
   * Calculate password strength.
   * 
   * STRENGTH CRITERIA:
   * - Length >= 12 characters (+1)
   * - Contains both lowercase and uppercase letters (+1)
   * - Contains numbers (+1)
   * - Contains special characters (+1)
   * 
   * Returns: 0-4 (0 = Very Weak, 4 = Very Strong)
   * 
   * WHY THIS MATTERS:
   * - Encourages users to create strong passwords
   * - Visual feedback helps users understand password security
   * - Aligns with security best practices
   */
  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 12) strength++ // Length requirement
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++ // Mixed case
    if (/\d/.test(password)) strength++ // Numbers
    if (/[^a-zA-Z\d]/.test(password)) strength++ // Special characters
    return strength
  }

  // Calculate current password strength
  const passwordStrength = getPasswordStrength(password)
  
  // Labels for each strength level
  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  
  // Tailwind CSS color classes for each strength level
  const strengthColors = [
    'bg-red-500',      // Very Weak
    'bg-orange-500',   // Weak
    'bg-yellow-500',   // Fair
    'bg-lime-500',     // Strong
    'bg-green-500',    // Very Strong
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-6">Create an account</h1>
      
      {/* Error message display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name field */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your name"
          />
        </div>

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

        {/* Password field with strength indicator */}
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
            minLength={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Create a password (min 12 characters)"
          />
          
          {/* Password strength indicator - only shown when password is entered */}
          {password && (
            <div className="mt-2">
              {/* Strength bar - 4 segments */}
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded ${
                      // Fill segments up to current strength level
                      i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {/* Strength label text */}
              <p className="text-xs text-gray-500 mt-1">
                {strengthLabels[passwordStrength]}
              </p>
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {/* Show loading text while submitting */}
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      {/* Link to sign-in page */}
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </div>
  )
}
