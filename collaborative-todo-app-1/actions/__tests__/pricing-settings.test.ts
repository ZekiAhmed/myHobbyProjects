/**
 * @fileoverview Server-entrypoint tests for the pricing/bank-details
 * settings save (subscription-billing issue 02)
 *
 * CONTRACT UNDER TEST (savePricingSettings):
 * 1. An Administrator saving valid input gets a success result and the
 *    values are persisted as the singleton record (round-trip)
 * 2. A regular signed-in user is refused with an authorization error
 *    and nothing is written — the record is Administrator-only
 * 3. Account numbers outside the 6–15 digit rule (too short, too long,
 *    non-digits) are refused as validation errors with no writes
 * 4. Other invalid input (price, currency, blank required fields) is
 *    refused as a validation error with no writes
 * 5. A database failure surfaces as a server error, never a success
 *
 * External behavior only — session and db mocked at the module boundary
 * (prior art: actions/__tests__/admin.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPlatformRole: vi.fn(),
}))
const prismaMock = vi.hoisted(() => ({
  pricingSettings: { upsert: vi.fn() },
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
  getPlatformRole: (userId: string) => sessionMock.getPlatformRole(userId),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { savePricingSettings } from '@/actions/pricing-settings'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

const VALID_INPUT = {
  price: 150,
  currency: 'ETB',
  accountHolder: 'Zeki Ahmed',
  accountNumber: '123456789012',
  bankName: 'Commercial Bank of Ethiopia',
  transferInstructions: 'Include your payment reference in the memo.',
}

function signIn(userId: string, role: 'REGULAR' | 'ADMINISTRATOR') {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
  sessionMock.getPlatformRole.mockResolvedValue(role)
}

/** Account numbers that must fail the 6–15 digit rule. */
const BAD_ACCOUNT_NUMBERS: Array<[string, string]> = [
  ['too short', '12345'],
  ['too long', '1234567890123456'],
  ['non-digits', '12345-67890'],
]

/** Other invalid inputs, each a partial override of the valid payload. */
const BAD_FIELDS: Array<[string, Partial<typeof VALID_INPUT>]> = [
  ['a non-integer price', { price: 99.5 }],
  ['a non-positive price', { price: 0 }],
  ['a too-long currency code', { currency: 'ETBB' }],
  ['a blank account holder', { accountHolder: '   ' }],
  ['a blank bank name', { bankName: '' }],
]

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.pricingSettings.upsert.mockImplementation(
    async ({ create }: { create: Record<string, unknown> }) => ({
      ...create,
      createdAt: new Date('2026-09-28'),
      updatedAt: new Date('2026-09-28'),
    })
  )
})

describe('savePricingSettings', () => {
  it('persists valid input as the singleton record when the actor is an Administrator', async () => {
    signIn('user_admin', 'ADMINISTRATOR')

    const result = await savePricingSettings(VALID_INPUT)

    // round-trip: what went in comes back out
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.price).toBe(150)
      expect(result.data.currency).toBe('ETB')
      expect(result.data.accountHolder).toBe('Zeki Ahmed')
      expect(result.data.accountNumber).toBe('123456789012')
      expect(result.data.bankName).toBe('Commercial Bank of Ethiopia')
      expect(result.data.transferInstructions).toBe(
        'Include your payment reference in the memo.'
      )
    }

    // written as the one settings record
    expect(prismaMock.pricingSettings.upsert).toHaveBeenCalledWith({
      where: { id: PRICING_SETTINGS_ID },
      update: {
        price: 150,
        currency: 'ETB',
        accountHolder: 'Zeki Ahmed',
        accountNumber: '123456789012',
        bankName: 'Commercial Bank of Ethiopia',
        transferInstructions: 'Include your payment reference in the memo.',
      },
      create: expect.objectContaining({
        id: PRICING_SETTINGS_ID,
        price: 150,
        currency: 'ETB',
      }),
    })
  })

  it('refuses a regular signed-in user with an authorization error and writes nothing', async () => {
    signIn('user_regular', 'REGULAR')

    const result = await savePricingSettings(VALID_INPUT)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.pricingSettings.upsert).not.toHaveBeenCalled()
  })

  it.each(BAD_ACCOUNT_NUMBERS)(
    'refuses an account number that is %s as a validation error',
    async (_label, accountNumber) => {
      signIn('user_admin', 'ADMINISTRATOR')

      const result = await savePricingSettings({ ...VALID_INPUT, accountNumber })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
        expect(result.error.message).toMatch(/6.*15 digits/i)
      }
      expect(prismaMock.pricingSettings.upsert).not.toHaveBeenCalled()
    }
  )

  it.each(BAD_FIELDS)(
    'refuses %s as a validation error with no writes',
    async (_label, override) => {
      signIn('user_admin', 'ADMINISTRATOR')

      const result = await savePricingSettings({ ...VALID_INPUT, ...override })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation')
      }
      expect(prismaMock.pricingSettings.upsert).not.toHaveBeenCalled()
    }
  )

  it('surfaces a database failure as a server error, never a success', async () => {
    signIn('user_admin', 'ADMINISTRATOR')
    prismaMock.pricingSettings.upsert.mockRejectedValue(new Error('connection reset'))

    const result = await savePricingSettings(VALID_INPUT)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('server')
    }
  })
})
