/**
 * @fileoverview Subscribe Server Action — start a payment attempt
 * (subscription-billing issue 04)
 *
 * Clicking Subscribe on the upgrade screen creates the AWAITING_UPLOAD
 * record behind the payment instruction card: a unique payment reference
 * the user copies into their bank memo, a price/currency snapshot from
 * the settings record (spec §Money — a later price edit never
 * invalidates an in-flight payment), and a 48-hour TTL.
 *
 * Everything runs inside ONE Serializable transaction (spec §Payment
 * lifecycle): the per-user non-terminal guard, the lazy expiry of a
 * stale attempt, and the create — so two simultaneous clicks can never
 * both succeed, and an abandoned attempt can never deadlock a fresh one.
 *
 * AUTHORIZATION: getRequiredSession() is the gate (same as every other
 * action); there is no role check — any signed-in user may subscribe.
 */

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import {
  actionSuccess,
  actionError,
  GuardError,
  type ActionResult,
} from '@/lib/errors'
import {
  generatePaymentReference,
  PAYMENT_INSTRUCTION_TTL_MS,
  NON_TERMINAL_PAYMENT_STATUSES,
} from '@/lib/subscription'
import {
  PRICING_SETTINGS_ID,
  DEFAULT_PRICING_SETTINGS,
} from '@/lib/pricing-settings-schema'
import type { PaymentSubmission } from '@/lib/generated/prisma/browser'

/**
 * Starts a payment attempt for the signed-in user.
 *
 * @returns The new AWAITING_UPLOAD submission (reference + snapshot +
 *   48h TTL), or an error ActionResult: an actionable validation error
 *   when a non-terminal attempt already exists, a server error on
 *   database failure.
 */
export async function requestPaymentInstructions(): Promise<ActionResult<PaymentSubmission>> {
  try {
    const session = await getRequiredSession()
    const userId = session.user.id

    const submission = await prisma.$transaction(
      async (tx) => {
        const now = new Date()
        const open = await tx.paymentSubmission.findMany({
          where: { userId, status: { in: NON_TERMINAL_PAYMENT_STATUSES } },
          orderBy: { createdAt: 'desc' },
        })

        for (const attempt of open) {
          // Lazy expiry: a stale instruction never blocks a fresh one —
          // flip it to EXPIRED here, there is no cron (spec §Payment
          // lifecycle), then fall through to create the new attempt.
          if (attempt.status === 'AWAITING_UPLOAD' && attempt.expiresAt <= now) {
            await tx.paymentSubmission.update({
              where: { id: attempt.id },
              data: { status: 'EXPIRED' },
            })
            continue
          }

          if (attempt.status === 'PENDING') {
            throw new GuardError(
              'validation',
              `Your payment for reference ${attempt.reference} is already under review. ` +
                'You will be notified once an Administrator approves or rejects it.'
            )
          }

          throw new GuardError(
            'validation',
            `You already have a payment attempt in progress (reference ${attempt.reference}). ` +
              'Upload your receipt for that reference before starting a new one — ' +
              'one attempt at a time keeps payments from being double-counted.'
          )
        }

        const settings = await tx.pricingSettings.findUnique({
          where: { id: PRICING_SETTINGS_ID },
        })
        const pricing = settings ?? DEFAULT_PRICING_SETTINGS

        return tx.paymentSubmission.create({
          data: {
            userId,
            // stated explicitly (the column also defaults to it) so the
            // state a Subscribe click creates is visible in the write
            status: 'AWAITING_UPLOAD',
            reference: generatePaymentReference(),
            priceSnapshot: pricing.price,
            currencySnapshot: pricing.currency,
            expiresAt: new Date(now.getTime() + PAYMENT_INSTRUCTION_TTL_MS),
          },
        })
      },
      // Serializable, not Postgres' default READ COMMITTED: at READ
      // COMMITTED two simultaneous Subscribe clicks both read "no open
      // attempt", both pass the guard, and the user ends up with two
      // live attempts. Serializable forces the second transaction to
      // abort instead (surfaced as a retryable server error).
      { isolationLevel: 'Serializable' }
    )

    return actionSuccess(submission)
  } catch (error) {
    if (error instanceof GuardError) {
      return actionError(error.kind, error.message)
    }
    return actionError('server', 'Failed to start a payment attempt')
  }
}
