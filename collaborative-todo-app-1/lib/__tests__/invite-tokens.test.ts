import { describe, it, expect } from 'vitest'
import { generateInviteToken, getInvitationExpiry, isTokenExpired } from '../utils/invite-tokens'

describe('invite-tokens', () => {
  describe('generateInviteToken', () => {
    it('returns a 64-character hex string', () => {
      const token = generateInviteToken()
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('generates unique tokens', () => {
      const token1 = generateInviteToken()
      const token2 = generateInviteToken()
      expect(token1).not.toBe(token2)
    })
  })

  describe('getInvitationExpiry', () => {
    it('returns a Date 48 hours in the future', () => {
      const before = Date.now() + 48 * 60 * 60 * 1000 - 1000
      const expiry = getInvitationExpiry()
      const after = Date.now() + 48 * 60 * 60 * 1000 + 1000

      expect(expiry.getTime()).toBeGreaterThanOrEqual(before)
      expect(expiry.getTime()).toBeLessThanOrEqual(after)
    })
  })

  describe('isTokenExpired', () => {
    it('returns false for a future date', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60)
      expect(isTokenExpired(futureDate)).toBe(false)
    })

    it('returns true for a past date', () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60)
      expect(isTokenExpired(pastDate)).toBe(true)
    })
  })
})
