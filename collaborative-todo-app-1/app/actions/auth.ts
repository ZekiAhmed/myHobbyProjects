/**
 * @fileoverview Authentication Server Actions
 * 
 * This file contains server actions for authentication operations.
 * Server Actions are async functions that run on the server and can be
 * called from Client Components.
 * 
 * WHY USE SERVER ACTIONS?
 * - Type-safe (TypeScript checks both client and server)
 * - No need to create API endpoints manually
 * - Automatic loading states
 * - Better security (runs on server only)
 * 
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions
 */

'use server' // This directive marks ALL functions in this file as Server Actions

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers, cookies } from 'next/headers'

/**
 * Signs out the current user and redirects to sign-in page.
 * 
 * WHAT THIS FUNCTION DOES:
 * 1. Gets the current session from the request headers
 * 2. If a session exists, deletes it from the database
 * 3. Clears the session cookie
 * 4. Redirects to /sign-in
 * 
 * WHY CHECK FOR SESSION FIRST?
 * - User might already be signed out (cookie expired, etc.)
 * - Prevents errors from trying to sign out a non-existent session
 * - Better UX (no error message for already signed out users)
 * 
 * @example
 * // In a Client Component
 * import { signOut } from '@/app/actions/auth'
 * 
 * function SignOutButton() {
 *   return (
 *     <form action={signOut}>
 *       <button type="submit">Sign Out</button>
 *     </form>
 *   )
 * }
 */
export async function signOut() {
  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  // Sign out (deletes session from DB)
  if (session) {
    await auth.api.signOut({
      headers: await headers(),
    })
  }

  // Manually delete the session cookies (both naming conventions Better Auth uses)
  const cookieStore = await cookies()
  cookieStore.delete('better-auth.session_token')
  cookieStore.delete('better-auth-session_token')
  cookieStore.delete('__Secure-better-auth.session_token')
  cookieStore.delete('__Secure-better-auth-session_token')

  redirect('/sign-in')
}
