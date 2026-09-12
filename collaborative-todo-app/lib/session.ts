// These two functions are how EVERY protected Server Component, Server
// Action, and Route Handler checks "who is this, and are they logged in?"
//
// Remember: proxy.ts only checked for a cookie's *presence*. These functions
// do the real check — they ask Better Auth to validate the session against
// the database. This is the actual security boundary.

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Use this in any page/action/route that REQUIRES a logged-in user.
 * If there's no valid session, it redirects to /sign-in immediately —
 * callers don't need to handle a "null" case, because this function
 * either returns a real session or never returns at all (redirect throws).
 */
export async function getRequiredSession() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect('/sign-in')
  }

  return session
}

/**
 * Use this ONLY on pages that render for both logged-in AND anonymous
 * visitors — currently just /invite/[token], which needs to show different
 * UI depending on whether the visitor is already signed in.
 *
 * Unlike getRequiredSession(), this NEVER throws or redirects — it just
 * returns null if there's no session (or if the session check itself fails
 * for some reason, e.g. a transient DB hiccup). The caller is responsible
 * for handling the null case gracefully.
 */
export async function getOptionalSession() {
  try {
    return await auth.api.getSession({ headers: await headers() })
  } catch {
    return null
  }
}