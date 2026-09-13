import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = ['/boards']
const authRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('better-auth.session_token')

  // If the user is on an auth route and has a session, redirect to boards
  if (authRoutes.some(route => pathname.startsWith(route)) && sessionCookie) {
    return NextResponse.redirect(new URL('/boards', request.url))
  }

  // If the user is on a protected route and doesn't have a session, redirect to sign-in
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
