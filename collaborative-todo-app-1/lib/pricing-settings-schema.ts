/**
 * @fileoverview Pricing & bank-details settings — shared shape and
 * validation (subscription-billing issue 02)
 *
 * CLIENT-SAFE: this module deliberately has no database import, so the
 * admin form (a client component) can share the exact validation the
 * server action enforces without dragging Prisma into the browser
 * bundle. The database read lives in lib/pricing-settings.ts.
 */

import type { PricingSettings as PricingSettingsRow } from '@/lib/generated/prisma/browser'
import { z } from 'zod/v4'

export type PricingSettings = PricingSettingsRow

/** The singleton row's constant id. */
export const PRICING_SETTINGS_ID = 'singleton'

/**
 * First-run seed values: 100 ETB with placeholder bank fields.
 * `accountNumber` is all digits and 6–15 long so the seeded row passes
 * the same validation the save action enforces (issue 02 acceptance).
 */
export const DEFAULT_PRICING_SETTINGS = {
  price: 100,
  currency: 'ETB',
  accountHolder: 'Placeholder Account Holder',
  accountNumber: '0123456789',
  bankName: 'Placeholder Bank',
  transferInstructions:
    'Transfer the exact amount to the account above and include your payment reference in the transfer memo.',
} as const

/**
 * The editable fields of the record — the shape the admin form submits
 * and `savePricingSettings` validates (actions/pricing-settings.ts).
 */
export interface PricingSettingsInput {
  price: number
  currency: string
  accountHolder: string
  accountNumber: string
  bankName: string
  transferInstructions: string
}

/**
 * Validation for the settings form — shared by the server action
 * (authoritative) and the admin form (inline errors before the round
 * trip), so the two can never drift.
 *
 * `accountNumber` enforces the spec's 6–15 digit rule (issue 02) — the
 * column is a plain string, so this is the guard that keeps a typo from
 * shipping broken payment instructions.
 */
export const PricingSettingsSchema = z.object({
  // one message for both non-numeric input (NaN) and decimals: the form
  // submits whatever was typed and this schema is the single judge
  price: z
    .number('Price must be a whole number')
    .int('Price must be a whole number')
    .positive('Price must be greater than zero'),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter code')
    .transform((value) => value.toUpperCase()),
  accountHolder: z.string().trim().min(1, 'Account holder is required').max(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,15}$/, 'Account number must be 6–15 digits'),
  bankName: z.string().trim().min(1, 'Bank name is required').max(120),
  transferInstructions: z.string().trim().max(2000),
})
