/**
 * @fileoverview Tests for Session Helpers
 * 
 * This file contains tests for lib/session.ts (getOptionalSession, getRequiredSession).
 * 
 * TESTING STRATEGY:
 * - Mock external dependencies (auth, next/headers, next/navigation)
 * - Test both success and failure scenarios
 * - Verify correct behavior for authenticated and unauthenticated users
 * 
 * WHY MOCK DEPENDENCIES?
 * - Isolate the code under test
 * - Avoid making real database calls
 * - Control test outcomes (simulate auth success/failure)
 * - Make tests fast and deterministic
 * 
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mock the auth module.
 * 
 * WHY?
 * - We don't want to make real database calls in tests
 * - We need to control what getSession returns
 * - Allows us to test both authenticated and unauthenticated scenarios
 * 
 * WHAT'S MOCKED?
 * - auth.api.getSession: Returns mock session or null
 */
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(), // Mock function - we control its return value
    },
  },
}))

/**
 * Mock next/headers.
 * 
 * WHY?
 * - In Next.js, headers() is an async function that returns request headers
 * - In tests, we don't have real HTTP requests
 * - We need to mock it to return something (or nothing)
 */
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

/**
 * Mock next/navigation.
 * 
 * WHY?
 * - redirect() is a Next.js function that redirects the user
 * - In tests, we don't want actual redirects
 * - We need to verify that redirect() was called with correct arguments
 */
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

/**
 * Test suite for session helpers.
 */
describe('session helpers', () => {
  /**
   * Clear all mocks before each test.
   * 
   * WHY?
   * - Prevents test pollution (one test affecting another)
   * - Ensures clean state for each test
   * - Clears mock call counts and return values
   */
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Tests for getOptionalSession().
   */
  describe('getOptionalSession', () => {
    /**
     * Test: Should return session when user is authenticated.
     * 
     * SCENARIO:
     * - User is signed in (has valid session)
     * - getOptionalSession() should return the session object
     */
    it('should return session when authenticated', async () => {
      // Create a mock session object (matches Better Auth's session structure)
      const mockSession = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        session: {
          id: 'session1',
          token: 'token1',
        },
      }

      // Configure the mock to return our mock session
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any)

      // Call the function we're testing
      const { getOptionalSession } = await import('@/lib/session')
      const session = await getOptionalSession()

      // Verify the result matches our mock session
      expect(session).toEqual(mockSession)
    })

    /**
     * Test: Should return null when user is not authenticated.
     * 
     * SCENARIO:
     * - User is not signed in (no session)
     * - getOptionalSession() should return null
     */
    it('should return null when not authenticated', async () => {
      // Configure the mock to return null (no session)
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      // Call the function we're testing
      const { getOptionalSession } = await import('@/lib/session')
      const session = await getOptionalSession()

      // Verify the result is null
      expect(session).toBeNull()
    })
  })

  /**
   * Tests for getRequiredSession().
   */
  describe('getRequiredSession', () => {
    /**
     * Test: Should return session when user is authenticated.
     * 
     * SCENARIO:
     * - User is signed in (has valid session)
     * - getRequiredSession() should return the session object
     */
    it('should return session when authenticated', async () => {
      // Create a mock session object
      const mockSession = {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        session: {
          id: 'session1',
          token: 'token1',
        },
      }

      // Configure the mock to return our mock session
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any)

      // Call the function we're testing
      const { getRequiredSession } = await import('@/lib/session')
      const session = await getRequiredSession()

      // Verify the result matches our mock session
      expect(session).toEqual(mockSession)
    })

    /**
     * Test: Should redirect to sign-in when user is not authenticated.
     * 
     * SCENARIO:
     * - User is not signed in (no session)
     * - getRequiredSession() should redirect to /sign-in
     * 
     * WHY DOES THIS THROW?
     * - Next.js's redirect() throws a special error
     * - This is expected behavior (not a bug)
     * - We catch it with rejectstoThrow()
     */
    it('should redirect to sign-in when not authenticated', async () => {
      // Configure the mock to return null (no session)
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      // Configure redirect mock to throw (simulating Next.js behavior)
      const { redirect } = await import('next/navigation')
      vi.mocked(redirect).mockImplementation(() => {
        throw new Error('Redirect')
      })

      // Call the function we're testing
      const { getRequiredSession } = await import('@/lib/session')

      // Verify it throws the redirect error
      await expect(getRequiredSession()).rejects.toThrow('Redirect')
      
      // Verify redirect was called with correct URL
      expect(redirect).toHaveBeenCalledWith('/sign-in')
    })
  })
})
