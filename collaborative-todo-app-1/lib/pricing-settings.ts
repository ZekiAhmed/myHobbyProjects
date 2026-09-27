/**
 * @fileoverview Pricing & bank-details settings — the single source of
 * truth (subscription-billing issue 02)
 *
 * One `PricingSettings` row (constant id) holds what the upgrade screen
 * shows and what Administrators edit from /admin: price, currency, and
 * the bank details for the manual transfer. Submissions snapshot
 * price+currency at creation (issue 05), so later edits here never
 * invalidate an in-flight payment.
 *
 * The shape, seed constants, and shared validation live in
 * lib/pricing-settings-schema.ts (client-safe); this module is the
 * server-side read.
 *
 * The record is seeded by migration `20260928000000_seed_pricing_
 * settings` (100 ETB + placeholder bank fields), NOT at render time —
 * reading during render must never write (Next.js data-security rules).
 * The in-memory fallback below only covers a deleted row: the form
 * still shows the seed values, and saving re-creates the record through
 * the save action's upsert.
 *
 * NOT a Server Action: exposing this read as a callable action would
 * hand the record to anyone with a session. The only caller today is
 * the admin page behind requireAdmin().
 */

import { prisma } from '@/lib/db'
import {
  PRICING_SETTINGS_ID,
  DEFAULT_PRICING_SETTINGS,
  type PricingSettingsInput,
} from '@/lib/pricing-settings-schema'

/**
 * Reads the settings record for server components behind the admin
 * gate — never writes.
 *
 * @returns The singleton row, or the seed defaults when it is missing
 */
export async function getPricingSettings(): Promise<PricingSettingsInput> {
  const row = await prisma.pricingSettings.findUnique({
    where: { id: PRICING_SETTINGS_ID },
  })

  return row ?? { ...DEFAULT_PRICING_SETTINGS }
}
