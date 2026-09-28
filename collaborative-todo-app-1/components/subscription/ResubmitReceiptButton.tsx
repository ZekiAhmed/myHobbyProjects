'use client'

/**
 * @fileoverview "Submit a new receipt" — the way back in after a rejection
 * (subscription-billing issue 08, spec story 20)
 *
 * Rendered inside billing history next to a REJECTED attempt, right under
 * the rejection reason: one mistake must not dead-end the subscription.
 *
 * It starts a FRESH payment attempt through the same action the upgrade
 * screen's Subscribe button uses — so the "one non-terminal attempt at a
 * time" guard, the price snapshot, and the 48-hour TTL all stay owned by
 * that one transaction (issue 04) — then navigates to the upgrade screen
 * where the new payment instruction card (reference, amount, bank
 * details) is what the subscriber lands on.
 *
 * Refusals are actionable by design (a live attempt names its
 * reference); same rationale as SubscribeButton, the validation message
 * is toasted here because this button has no inline surface for it.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { requestPaymentInstructions } from '@/actions/subscribe'
import { handleActionResult, handleMutationError, toast } from '@/lib/toast'

export function ResubmitReceiptButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleResubmit() {
    startTransition(async () => {
      try {
        const result = await requestPaymentInstructions()

        handleActionResult(result, {
          successMessage: 'Payment instructions ready',
          onSuccess: () => router.push('/upgrade'),
          onError: (error) => {
            // the helper stays silent on validation by design (it assumes
            // inline form feedback); this button has no inline surface, so
            // the actionable message (a live attempt's reference) is
            // toasted here — server/authorization refusals already toast
            // (with retry), so toasting again would double up
            if (error.type === 'validation') toast.error(error.message)
          },
        })
      } catch (error) {
        handleMutationError(error)
      }
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleResubmit}
      disabled={isPending}
      data-testid="submit-new-receipt"
    >
      {isPending ? 'Starting…' : 'Submit a new receipt'}
    </Button>
  )
}
