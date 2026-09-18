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
import { acceptInvitation } from '@/app/actions/invitations'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const inviteToken = searchParams.get('inviteToken')
  const sessionExpired = searchParams.get('sessionExpired') === 'true'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (sessionExpired) {
      setError('Your session has expired. Please sign in again.')
    }
  }, [sessionExpired])

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await authClient.getSession()
      if (data?.session) {
        if (inviteToken) {
          acceptInvitation(inviteToken)
            .then((result) => {
              if (result.success) {
                router.push(`/boards/${result.data.boardId}`)
              } else {
                router.push(callbackUrl)
              }
            })
            .catch(() => {
              router.push(callbackUrl)
            })
        } else {
          router.push(callbackUrl)
        }
      }
    }
    checkSession()
  }, [router, callbackUrl, inviteToken])

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
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        const errorMessage = result.error.message || 'Failed to sign in'
        
        if (errorMessage.includes('verified')) {
          setError('Please verify your email address before signing in')
        } else {
          setError(errorMessage)
        }
      } else {
        if (inviteToken) {
          try {
            const inviteResult = await acceptInvitation(inviteToken)
            if (inviteResult.success) {
              router.push(`/boards/${inviteResult.data.boardId}`)
            } else {
              router.push(callbackUrl)
            }
            return
          } catch {
            router.push(callbackUrl)
            return
          }
        }
        router.push(callbackUrl)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
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
