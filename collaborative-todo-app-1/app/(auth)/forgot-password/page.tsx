'use client'

import { useState } from 'react'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })
      
      if (result.error) {
        setError(result.error.message || 'Failed to send reset email')
      } else {
        setMessage('Password reset email sent! Please check your inbox.')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-center mb-6">Forgot your password?</h1>
      
      <p className="text-gray-600 text-center mb-6">
        Enter your email address and we'll send you a link to reset your password.
      </p>

      {message && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

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
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-600">
        Remember your password?{' '}
        <Link href="/sign-in" className="text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </div>
  )
}
