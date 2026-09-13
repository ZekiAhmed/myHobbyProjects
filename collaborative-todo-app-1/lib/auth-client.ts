/**
 * @fileoverview Better Auth Client-Side Configuration
 * 
 * This module creates and exports the Better Auth client for use in React components.
 * The client handles all client-side authentication operations.
 * 
 * SERVER vs CLIENT:
 * - lib/auth.ts (server) - Used in Server Components, Server Actions, Route Handlers
 * - lib/auth-client.ts (client) - Used in Client Components ('use client')
 * 
 * WHY SEPARATE CLIENTS?
 * - Server code can directly access the database
 * - Client code must make HTTP requests to the auth API
 * - Better Auth handles this distinction automatically
 * 
 * @see https://better-auth.com/docs/concepts/client
 */

import { createAuthClient } from 'better-auth/client'

/**
 * Create the Better Auth client instance.
 * 
 * The client communicates with the auth API endpoints:
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-out
 * - POST /api/auth/send-verification-email
 * - POST /api/auth/request-password-reset
 * - POST /api/auth/reset-password
 * 
 * @param baseURL - The base URL of your application
 *   - In development: http://localhost:3000
 *   - In production: https://your-domain.com
 * 
 * WHY is this needed?
 * - The client needs to know where the auth API is located
 * - Allows the app to work in different environments
 * - Uses NEXT_PUBLIC_APP_URL (accessible in browser)
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})

/**
 * Destructure commonly used auth methods.
 * 
 * WHY destructure?
 * - Cleaner imports in components
 * - Better TypeScript inference
 * - Easier to use in code
 * 
 * Available methods:
 * - signIn - Sign in with email/password
 * - signUp - Sign up with email/password
 * - signOut - Sign out current user
 * - sendVerificationEmail - Resend verification email
 * 
 * @example
 * import { signIn, signOut } from '@/lib/auth-client'
 * 
 * // Sign in
 * await signIn.email({ email, password })
 * 
 * // Sign out
 * await signOut()
 */
export const { signIn, signUp, signOut, sendVerificationEmail } = authClient
