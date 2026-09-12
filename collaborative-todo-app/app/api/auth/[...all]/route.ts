// A catch-all route that hands EVERY request under /api/auth/* to Better
// Auth's own handler. This is what actually implements sign-in, sign-up,
// sign-out, session lookups, password reset, etc. — we never write these
// endpoints ourselves.

import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)