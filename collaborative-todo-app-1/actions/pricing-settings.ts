/**
 * @fileoverview Pricing & bank-details settings Server Action
 * (subscription-billing issue 02)
 *
 * The Administrator edits the single pricing record from the admin
 * area: price, currency, account holder, account number, bank name,
 * and transfer instructions. The saved values are the single source of
 * truth the upgrade screen reads (submissions snapshot price+currency
 * at creation, so a later edit never invalidates an in-flight payment).
 *
 * AUTHORIZATION: defense in depth — /admin renders behind requireAdmin(),
 * and this action re-checks the platform role itself, so a stale open
 * session that lost the Administrator role is refused with an
 * authorization ActionResult instead of a write.
 */

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession, getPlatformRole } from '@/lib/session'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import {
  PRICING_SETTINGS_ID,
  PricingSettingsSchema,
  type PricingSettings,
  type PricingSettingsInput,
} from '@/lib/pricing-settings-schema'

/**
 * Saves the pricing/bank-details settings (Administrators only).
 *
 * Upserts the singleton row, so saving works whether or not the
 * first-run seed has happened yet.
 *
 * @param input - The form values (validated here, server-side)
 */
export async function savePricingSettings(
  input: PricingSettingsInput
): Promise<ActionResult<PricingSettings>> {
  try {
    const session = await getRequiredSession()

    if ((await getPlatformRole(session.user.id)) !== 'ADMINISTRATOR') {
      return actionError('authorization', 'Only Administrators can manage pricing settings')
    }

    const parsed = PricingSettingsSchema.safeParse(input)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid settings data')
    }

    const settings = await prisma.pricingSettings.upsert({
      where: { id: PRICING_SETTINGS_ID },
      update: parsed.data,
      create: { id: PRICING_SETTINGS_ID, ...parsed.data },
    })

    return actionSuccess(settings)
  } catch {
    return actionError('server', 'Failed to save pricing settings')
  }
}
