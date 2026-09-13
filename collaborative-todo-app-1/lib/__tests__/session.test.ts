import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('session helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOptionalSession', () => {
    it('should return session when authenticated', async () => {
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

      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any)

      const { getOptionalSession } = await import('@/lib/session')
      const session = await getOptionalSession()

      expect(session).toEqual(mockSession)
    })

    it('should return null when not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      const { getOptionalSession } = await import('@/lib/session')
      const session = await getOptionalSession()

      expect(session).toBeNull()
    })
  })

  describe('getRequiredSession', () => {
    it('should return session when authenticated', async () => {
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

      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any)

      const { getRequiredSession } = await import('@/lib/session')
      const session = await getRequiredSession()

      expect(session).toEqual(mockSession)
    })

    it('should redirect to sign-in when not authenticated', async () => {
      const { auth } = await import('@/lib/auth')
      vi.mocked(auth.api.getSession).mockResolvedValue(null)

      const { redirect } = await import('next/navigation')
      vi.mocked(redirect).mockImplementation(() => {
        throw new Error('Redirect')
      })

      const { getRequiredSession } = await import('@/lib/session')

      await expect(getRequiredSession()).rejects.toThrow('Redirect')
      expect(redirect).toHaveBeenCalledWith('/sign-in')
    })
  })
})
