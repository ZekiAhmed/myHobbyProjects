import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Resend module
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-id' }),
    },
  })),
}))

describe('email functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      const { sendVerificationEmail } = await import('@/lib/email')
      
      await sendVerificationEmail('test@example.com', 'verification-token')

      const { Resend } = await import('resend')
      const mockResend = vi.mocked(Resend).mock.results[0].value
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'Kanban <onboarding@resend.dev>',
        to: 'test@example.com',
        subject: 'Verify your email address',
        expect: expect.stringContaining('verification-token'),
      })
    })
  })

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      const { sendPasswordResetEmail } = await import('@/lib/email')
      
      await sendPasswordResetEmail('test@example.com', 'reset-token')

      const { Resend } = await import('resend')
      const mockResend = vi.mocked(Resend).mock.results[0].value
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'Kanban <onboarding@resend.dev>',
        to: 'test@example.com',
        subject: 'Reset your password',
        expect: expect.stringContaining('reset-token'),
      })
    })
  })
})
