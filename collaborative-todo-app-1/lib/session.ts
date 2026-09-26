/**
 * @fileoverview Session Management Helpers
 * 
 * This module provides helper functions for getting the current user's session.
 * Sessions are used to identify who is currently signed in.
 * 
 * WHY THESE HELPERS?
 * - getRequiredSession: For protected routes (redirects if not signed in)
 * - getOptionalSession: For routes that work with or without auth
 * - requireAdmin: For the Administration area (403s if not an
 *   Administrator — see below)
 * - getPlatformRole: Shared platform-role read, used by requireAdmin and
 *   the promote/demote actions
 * 
 * WHEN TO USE WHICH?
 * - getRequiredSession: Dashboard, board pages, settings, etc.
 * - getOptionalSession: Landing page, public boards (future), etc.
 * - requireAdmin: The Administration area only (platform role, not board Owner)
 * - getPlatformRole: Anywhere the platform role must be checked
 * 
 * @see https://better-auth.com/docs/concepts/session-management
 */

import { redirect, forbidden } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
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

/**
 * Reads the platform role (CONTEXT.md: "Administrator") of one user.
 * Single source of truth for role lookups — the Administration gate and
 * the promote/demote actions both go through here.
 *
 * @param userId - The user whose role to read
 * @returns The role, or null when the user row no longer exists
 */
export async function getPlatformRole(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  return user?.role ?? null
}

/**
 * Gets the current session only if the user is a platform Administrator.
 * 
 * USE THIS WHEN:
 * - The page is part of the Administration area (platform role, distinct
 *   from the board Owner role — CONTEXT.md bans "admin" for board roles)
 * 
 * HOW IT WORKS:
 * 1. Calls getRequiredSession() — signed-out visitors are redirected to
 *    /sign-in exactly like every other protected route
 * 2. Reads the user's `role` from the database (fresh on every call, so a
 *    demotion takes effect on the next request, not the next sign-in)
 * 3. Anything other than ADMINISTRATOR (regular role, or a session whose
 *    user row is gone) calls forbidden() — Next.js renders the 403
 *    forbidden boundary for the route
 * 
 * @returns The session object for an Administrator
 * @throws Redirects to /sign-in if not authenticated; throws the forbidden
 *   interrupt (HTTP 403) if authenticated but not an Administrator
 * 
 * @example
 * // In the Administration area's Server Component
 * export default async function AdminPage() {
 *   const session = await requireAdmin()
 *   return <h1>Administration</h1>
 * }
 */
export async function requireAdmin() {
  const session = await getRequiredSession()

  const role = await getPlatformRole(session.user.id)

  if (role !== 'ADMINISTRATOR') {
    forbidden()
  }

  return session
}
