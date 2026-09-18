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
const protectedRoutes = ['/boards']

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
  const sessionCookie = getSessionCookie(request)

  if (protectedRoutes.some(route => pathname.startsWith(route)) && !sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    signInUrl.searchParams.set('sessionExpired', 'true')
    return NextResponse.redirect(signInUrl)
  }

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
