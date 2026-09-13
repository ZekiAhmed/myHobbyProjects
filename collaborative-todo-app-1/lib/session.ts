/**
 * @fileoverview Session Management Helpers
 * 
 * This module provides helper functions for getting the current user's session.
 * Sessions are used to identify who is currently signed in.
 * 
 * WHY TWO FUNCTIONS?
 * - getRequiredSession: For protected routes (redirects if not signed in)
 * - getOptionalSession: For routes that work with or without auth
 * 
 * WHEN TO USE WHICH?
 * - getRequiredSession: Dashboard, board pages, settings, etc.
 * - getOptionalSession: Landing page, public boards (future), etc.
 * 
 * @see https://better-auth.com/docs/concepts/session-management
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * Gets the current user's session, redirecting to sign-in if not authenticated.
 * 
 * USE THIS WHEN:
 * - The page/action requires authentication
 * - You want to redirect unauthenticated users to sign-in
 * - You need the session data (user info)
 * 
 * HOW IT WORKS:
 * 1. Calls getOptionalSession() to try to get the session
 * 2. If no session exists, redirects to /sign-in
 * 3. If session exists, returns it
 * 
 * @returns The session object containing user and session data
 * @throws Will redirect to /sign-in if not authenticated
 * 
 * @example
 * // In a Server Component
 * export default async function DashboardPage() {
 *   const session = await getRequiredSession()
 *   return <h1>Welcome, {session.user.name}</h1>
 * }
 */
export async function getRequiredSession() {
  const session = await getOptionalSession()
  
  // If no session, redirect to sign-in page
  // This is a server-side redirect (not client-side)
  // The user's browser will be redirected to /sign-in
  if (!session) {
    redirect('/sign-in')
  }
  
  return session
}

/**
 * Gets the current user's session without redirecting.
 * 
 * USE THIS WHEN:
 * - The page works with or without authentication
 * - You want to show different content based on auth state
 * - You need to check if a user is signed in, but not force it
 * 
 * HOW IT WORKS:
 * 1. Calls Better Auth's getSession API
 * 2. Passes the request headers (contains session cookie)
 * 3. Better Auth validates the session and returns user data
 * 4. Returns null if no valid session exists
 * 
 * @returns The session object, or null if not authenticated
 * 
 * @example
 * // In a Server Component
 * export default async function HomePage() {
 *   const session = await getOptionalSession()
 *   
 *   if (session) {
 *     return <h1>Welcome back, {session.user.name}</h1>
 *   }
 *   
 *   return <h1>Welcome! Please sign in.</h1>
 * }
 */
export async function getOptionalSession() {
  // Get the request headers (contains the session cookie)
  // We need to await headers() because Next.js 15+ makes it async
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  
  return session
}
