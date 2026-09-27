/**
 * @fileoverview Read tests for the pricing/bank-details settings
 * (subscription-billing issue 02)
 *
 * CONTRACT UNDER TEST (getPricingSettings):
 * 1. An existing record is returned untouched — the read never writes
 * 2. When no record exists (a deleted row), the seed defaults come back
 *    — 100 ETB plus placeholder bank fields whose account number obeys
 *    the 6–15 digit rule — again with no write: rendering must never
 *    mutate the database; the migration owns the first-run seed and the
 *    save action's upsert re-creates a missing row
 *
 * External behavior only — prisma mocked at the module boundary; the
 * expected seed values come from the spec ("Seed values: 100 ETB with
 * placeholder bank fields"), not from the implementation constants
 * (prior art: actions/__tests__/admin.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  pricingSettings: { findUnique: vi.fn(), create: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { getPricingSettings } from '@/lib/pricing-settings'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

const EXISTING_ROW = {
  id: PRICING_SETTINGS_ID,
  price: 250,
  currency: 'USD',
  accountHolder: 'Acme Inc',
  accountNumber: '123456789012',
  bankName: 'Awash Bank',
  transferInstructions: 'Include your payment reference in the memo.',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getPricingSettings', () => {
  it('returns an existing record untouched — the read never writes', async () => {
    prismaMock.pricingSettings.findUnique.mockResolvedValue(EXISTING_ROW)

    const result = await getPricingSettings()

    expect(result).toEqual(EXISTING_ROW)
    expect(prismaMock.pricingSettings.findUnique).toHaveBeenCalledWith({
      where: { id: PRICING_SETTINGS_ID },
    })
    expect(prismaMock.pricingSettings.create).not.toHaveBeenCalled()
  })

  it('returns the seed defaults when no record exists, without writing', async () => {
    prismaMock.pricingSettings.findUnique.mockResolvedValue(null)

    const result = await getPricingSettings()

    // the spec's seed values
    expect(result.price).toBe(100)
    expect(result.currency).toBe('ETB')
    // placeholders exist for every bank field, and the account number
    // obeys the 6–15 digit rule the save action enforces
    expect(result.accountHolder.length).toBeGreaterThan(0)
    expect(result.accountNumber).toMatch(/^\d{6,15}$/)
    expect(result.bankName.length).toBeGreaterThan(0)
    expect(result.transferInstructions.length).toBeGreaterThan(0)
    expect(prismaMock.pricingSettings.create).not.toHaveBeenCalled()
  })
})
