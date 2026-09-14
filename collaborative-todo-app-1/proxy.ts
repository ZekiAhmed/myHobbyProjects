/**
 * @fileoverview Route Protection Middleware (Proxy)
 * 
 * This file implements route protection using Next.js 16's proxy feature.
 * The proxy runs BEFORE every request and can redirect, block, or modify requests.
 * 
 * WHY USE PROXY?
 * - Protects routes without checking the database (fast)
 * - Uses only the session cookie for quick redirects
 * - Provides good UX by redirecting users appropriately
 * 
 * IMPORTANT: This is NOT a security boundary!
 * - The proxy only checks for the EXISTENCE of a session cookie
 * - It does NOT validate the cookie (that happens in Server Components/Actions)
 * - Someone could manually create a cookie to bypass this
 * - Always validate sessions server-side for actual security
 * 
 * @see https://nextjs.org/docs/app/building-your-application/routing/proxy
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

/**
 * Routes that require authentication.
 * Users without a session cookie will be redirected to /sign-in.
 */
const protectedRoutes = ['/', '/boards']

/**
 * Routes that are only for unauthenticated users.
 * Users with a session cookie will be redirected to /boards.
 * 
 * WHY redirect authenticated users away from auth pages?
 * - Prevents confusion (already signed in, why show sign-in?)
 * - Better UX (redirect to dashboard automatically)
 */
const authRoutes = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]

/**
 * Main proxy function that runs for every matched request.
 * 
 * @param request - The incoming HTTP request
 * @returns NextResponse - Either a redirect or the next handler
 * 
 * HOW IT WORKS:
 * 1. Check if the user has a session cookie
 * 2. Check which route they're trying to access
 * 3. Apply the appropriate redirect logic
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  /**
   * Check for the session cookie using Better Auth's helper.
   * 
   * WHY use getSessionCookie instead of manually checking?
   * - Automatically handles the correct cookie name
   * - Works even if you customize the cookie name in auth config
   * - Recommended by Better Auth documentation
   * 
   * NOTE: This only checks for cookie EXISTENCE, not validity.
   * For security, always validate the session server-side.
   */
  const sessionCookie = getSessionCookie(request)

  /**
   * SCENARIO 1: User is on an auth page AND has a session
   * 
   * Example: User visits /sign-in but is already signed in
   * Action: Redirect to /boards (their dashboard)
   * 
   * WHY?
   * - Better UX (don't show sign-in if already signed in)
   * - Prevents confusion
   */
  if (authRoutes.some(route => pathname.startsWith(route)) && sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  /**
   * SCENARIO 2: User is on a protected page AND doesn't have a session
   * 
   * Example: User visits /boards without signing in
   * Action: Redirect to /sign-in with callbackUrl
   * 
   * WHAT IS callbackUrl?
   * - A query parameter that tells sign-in where to redirect after
   * - Example: /sign-in?callbackUrl=/boards/abc123
   * - After sign-in, user is redirected back to /boards/abc123
   */
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  /**
   * SCENARIO 3: No redirect needed
   * 
   * Either:
   * - User is on a public page (no auth required)
   * - User is on an auth page without a session (normal)
   * - User is on a protected page with a session (normal)
   * 
   * Action: Continue to the next handler/page
   */
  return NextResponse.next()
}

/**
 * Route matcher configuration.
 * 
 * This tells Next.js which routes should be handled by this proxy.
 * 
 * PATTERN BREAKDOWN: /((?!api|_next/static|_next/image|favicon.ico).*)
 * - /((?!...).*) - Match all routes EXCEPT those starting with...
 * - api - Exclude API routes (they handle their own auth)
 * - _next/static - Exclude static files (CSS, JS bundles)
 * - _next/image - Exclude image optimization
 * - favicon.ico - Exclude the favicon
 * 
 * WHY exclude these?
 * - Static files don't need auth checks
 * - API routes have their own auth logic
 * - Prevents unnecessary middleware execution
 */
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
