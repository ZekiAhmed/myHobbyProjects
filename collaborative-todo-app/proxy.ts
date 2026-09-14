// WHY THIS FILE EXISTS AND ISN'T CALLED "middleware.ts":
// This project uses a Next.js 16 convention where edge-level route interception
// is done via `proxy.ts` instead of the older `middleware.ts` file. If you're
// used to older Next.js projects, don't go looking for middleware.ts — it
// doesn't exist here on purpose.
//
// WHAT THIS FILE DOES (and does NOT do):
//   ✅ Checks if a session cookie is present on the request.
//   ✅ Redirects unauthenticated users to /sign-in, remembering where they
//      were trying to go (via ?callbackUrl=...).
//   ❌ Does NOT verify the cookie is a *valid, unexpired* session — that would
//      require a database round-trip, which we deliberately avoid at the edge
//      for speed. That real check happens later, in getRequiredSession().
//
// Because of that second point: NEVER treat "proxy.ts let the request through"
// as proof the user is authenticated. Every Server Component, Server Action,
// and Route Handler that touches user data must independently call
// getRequiredSession() (see lib/session.ts). This file is a UX convenience,
// not a security boundary.

import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  // Better Auth sets a plain cookie in dev/http, and a "__Secure-" prefixed
  // cookie in production/https. We check both names so this works locally
  // and in production without any config changes.
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token')

  // No cookie at all => definitely not logged in => bounce to sign-in.
  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)

    // Remember where the user was headed so we can send them back there
    // right after they successfully sign in. See app/(auth)/sign-in/page.tsx.
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)

    return NextResponse.redirect(signInUrl)
  }

  // Cookie exists — let the request continue. The real auth/authorization
  // check happens deeper in the request lifecycle.
  return NextResponse.next()
}

// `matcher` tells Next.js which paths this proxy should even run on.
// We EXCLUDE all public/semi-public routes and static assets so we don't
// waste a cookie-check on pages that don't need auth.


// proxy.ts — exclude the whole /api tree, not just api/auth and api/health.
// API routes now handle their own 401s (see getApiSession above); letting
// proxy.ts redirect them just recreates the same fetch-follows-redirect bug.
export const config = {
  matcher: [
    '/((?!sign-in|sign-up|forgot-password|reset-password|verify-email|invite|api|_next/static|_next/image|favicon\\.ico).*)',
  ],
}