/**
 * @fileoverview Authentication API Route Handler
 * 
 * This file handles all authentication-related API requests.
 * It uses a catch-all route [...all] to handle multiple endpoints.
 * 
 * CATCH-ALL ROUTE:
 * - The [...] syntax matches any path under /api/auth/
 * - Examples: /api/auth/sign-in, /api/auth/sign-out, /api/auth/sign-up
 * - Better Auth handles all routing internally
 * 
 * ENDPOINTS HANDLED:
 * - POST /api/auth/sign-in/email - Sign in with email/password
 * - POST /api/auth/sign-up/email - Sign up with email/password
 * - POST /api/auth/sign-out - Sign out
 * - POST /api/auth/send-verification-email - Resend verification
 * - POST /api/auth/request-password-reset - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 * - GET /api/auth/get-session - Get current session
 * 
 * @see https://better-auth.com/docs/integrations/next
 */

import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

/**
 * Convert Better Auth to Next.js route handler.
 * 
 * toNextJsHandler:
 * - Takes the Better Auth instance
 * - Returns an object with GET and POST handlers
 * - Handles all auth endpoints automatically
 * - Sets correct headers and status codes
 * 
 * WHY export { GET, POST }?
 * - Next.js App Router expects these named exports
 * - GET for retrieving data (e.g., get-session)
 * - POST for mutations (e.g., sign-in, sign-up, sign-out)
 */
export const { GET, POST } = toNextJsHandler(auth)
