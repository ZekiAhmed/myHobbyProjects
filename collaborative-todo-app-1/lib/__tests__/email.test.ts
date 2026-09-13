/**
 * @fileoverview Tests for Email Functions
 * 
 * This file contains tests for lib/email.ts (sendVerificationEmail, sendPasswordResetEmail).
 * 
 * TESTING STRATEGY:
 * - Mock the Resend SDK (don't send real emails)
 * - Verify correct email parameters (to, subject, HTML content)
 * - Test both email functions
 * 
 * WHY MOCK RESEND?
 * - Don't send real emails during testing
 * - Don't use API quota
 * - Control test outcomes
 * - Make tests fast and deterministic
 * 
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mock the Resend module.
 * 
 * WHY?
 * - We don't want to send real emails in tests
 * - We need to verify that emails are sent with correct parameters
 * - We need to control the mock's behavior
 * 
 * WHAT'S MOCKED?
 * - Resend class: Returns a mock instance
 * - emails.send: Mock function that returns success
 */
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-id' }), // Mock successful send
    },
  })),
}))

/**
 * Test suite for email functions.
 */
describe('email functions', () => {
  /**
   * Clear all mocks and set environment variables before each test.
   * 
   * WHY?
   * - Prevents test pollution
   * - Ensures consistent environment for each test
   * - Sets required environment variables
   */
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  /**
   * Tests for sendVerificationEmail().
   */
  describe('sendVerificationEmail', () => {
    /**
     * Test: Should send verification email with correct parameters.
     * 
     * SCENARIO:
     * - User signs up and needs email verification
     * - sendVerificationEmail() is called
     * - Email should be sent with correct recipient, subject, and content
     */
    it('should send verification email with correct parameters', async () => {
      // Import the function we're testing
      const { sendVerificationEmail } = await import('@/lib/email')
      
      // Call the function with test data
      await sendVerificationEmail('test@example.com', 'verification-token')

      // Get the mock Resend instance
      const { Resend } = await import('resend')
      const mockResend = vi.mocked(Resend).mock.results[0].value
      
      // Verify the email was sent with correct parameters
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'Kanban <onboarding@resend.dev>',
        to: 'test@example.com',
        subject: 'Verify your email address',
        // Verify the HTML contains the verification token
        expect: expect.stringContaining('verification-token'),
      })
    })
  })

  /**
   * Tests for sendPasswordResetEmail().
   */
  describe('sendPasswordResetEmail', () => {
    /**
     * Test: Should send password reset email with correct parameters.
     * 
     * SCENARIO:
     * - User forgot their password and requests a reset
     * - sendPasswordResetEmail() is called
     * - Email should be sent with correct recipient, subject, and content
     */
    it('should send password reset email with correct parameters', async () => {
      // Import the function we're testing
      const { sendPasswordResetEmail } = await import('@/lib/email')
      
      // Call the function with test data
      await sendPasswordResetEmail('test@example.com', 'reset-token')

      // Get the mock Resend instance
      const { Resend } = await import('resend')
      const mockResend = vi.mocked(Resend).mock.results[0].value
      
      // Verify the email was sent with correct parameters
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'Kanban <onboarding@resend.dev>',
        to: 'test@example.com',
        subject: 'Reset your password',
        // Verify the HTML contains the reset token
        expect: expect.stringContaining('reset-token'),
      })
    })
  })
})
