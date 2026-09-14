/**
 * @fileoverview Better Auth Server Configuration
 * 
 * This module configures and exports the Better Auth instance for the application.
 * Better Auth is a modern, open-source authentication library that provides:
 * - Email/password authentication
 * - Session management
 * - Email verification
 * - Password reset
 * - OAuth support (future use)
 * 
 * WHY BETTER AUTH?
 * - Built for Next.js and modern frameworks
 * - Type-safe with excellent TypeScript support
 * - Flexible and extensible via plugins
 * - Self-hosted (no external service dependency)
 * - Handles all auth complexity (sessions, tokens, security)
 * 
 * @see https://better-auth.com/docs
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email'

/**
 * The main Better Auth configuration object.
 * 
 * This is the heart of the authentication system. It configures:
 * 1. Database connection (via Prisma adapter)
 * 2. Authentication methods (email/password)
 * 3. Session management
 * 4. Security settings
 */
export const auth = betterAuth({
  /**
   * DATABASE ADAPTER
   * 
   * Better Auth needs to store users, sessions, and verification tokens.
   * We use the Prisma adapter to connect to our PostgreSQL database.
   * 
   * The adapter handles:
   * - Creating/reading/updating user records
   * - Managing sessions
   * - Storing verification tokens
   * 
   * WHY prismaAdapter?
   * - It's the official Prisma adapter for Better Auth
   * - Handles all database operations automatically
   * - Uses our existing Prisma schema
   */
  database: prismaAdapter(prisma, {
    provider: 'postgresql', // Must match your database provider
  }),

  /**
   * EMAIL AND PASSWORD AUTHENTICATION
   * 
   * This section configures how users sign up and sign in with email/password.
   */
  emailAndPassword: {
    /**
     * Enable email/password authentication.
     * Set to false to disable this auth method entirely.
     */
    enabled: true,

    /**
     * Require email verification before users can sign in.
     * 
     * WHY enable this?
     * - Prevents fake accounts
     * - Ensures users have access to their email
     * - Required for password reset to work
     * 
     * WHAT HAPPENS:
     * 1. User signs up
     * 2. Account is created but marked as "unverified"
     * 3. User receives verification email
     * 4. User clicks link in email
     * 5. Account is marked as "verified"
     * 6. User can now sign in
     */
    requireEmailVerification: true,

    /**
     * Minimum password length requirement.
     * 
     * WHY 12 characters?
     * - OWASP recommends at least 12 characters
     * - Longer passwords are exponentially harder to crack
     * - Users can use passphrases (e.g., "correct-horse-battery-staple")
     * 
     * Trade-off: Longer passwords are harder to remember, but security matters.
     */
    minPasswordLength: 12,

    /**
     * Function to send password reset emails.
     * 
     * Called when:
     * - A user requests a password reset
     * 
     * @param user - The user object (contains email)
     * @param token - The reset token (to include in the email link)
     */
    sendResetPassword: async ({ user, token }: { user: { email: string }; token: string }) => {
      await sendPasswordResetEmail(user.email, token)
    },
  },

  /**
   * EMAIL VERIFICATION CONFIGURATION
   * 
   * This section configures how email verification works.
   * It's separate from emailAndPassword because it handles the email sending.
   */
  emailVerification: {
    /**
     * Function to send verification emails.
     * 
     * Called when:
     * - A new user signs up
     * - A user requests to resend verification email
     * 
     * @param data - Contains user, url, and token
     * @param user - The user object (contains email)
     * @param url - The verification URL to include in the email
     * @param token - The verification token
     */
    sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
      // Extract token from the URL
      const urlObj = new URL(url)
      const token = urlObj.searchParams.get('token') || ''
      await sendVerificationEmail(user.email, token)
    },
  },

  /**
   * SESSION CONFIGURATION
   * 
   * Sessions allow users to stay signed in without re-entering credentials.
   */
  session: {
    /**
     * How long a session lasts (in seconds).
     * 
     * 60 * 60 * 24 * 7 = 7 days
     * 
     * WHY 7 days?
     * - Balances security and convenience
     * - Users don't have to sign in every day
     * - Sessions can be revoked if needed
     */
    expiresIn: 60 * 60 * 24 * 7,

    /**
     * How often the session is refreshed (in seconds).
     * 
     * 60 * 60 * 24 = 1 day
     * 
     * WHAT THIS MEANS:
     * - Sessions are refreshed every 24 hours
     * - This extends the session expiry
     * - Prevents sessions from expiring while user is active
     */
    updateAge: 60 * 60 * 24,
  },

  /**
   * TRUSTED ORIGINS
   * 
   * List of URLs that are allowed to make requests to the auth API.
   * 
   * WHY restrict origins?
   * - Prevents Cross-Site Request Forgery (CSRF) attacks
   * - Only your app can make auth requests
   * - Security best practice
   * 
   * Note: This should be your app's URL (including port in development)
   */
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
})

/**
 * TypeScript type for the session object.
 * 
 * This infers the session type from the auth configuration.
 * Use this type when you need to type session objects:
 * 
 * @example
 * const session: Session = await auth.api.getSession(...)
 * console.log(session.user.email)
 * 
 * WHY export this?
 * - Provides type safety throughout the app
 * - IDE autocomplete for session properties
 * - Catches type errors at compile time
 */
export type Session = typeof auth.$Infer.Session
