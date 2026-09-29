'use client'

/**
 * @fileoverview Subscribe button — starts a payment attempt
 * (subscription-billing issues 04 + 11)
 *
 * Calls the subscribe action, then refreshes the server-rendered
 * upgrade screen so the payment instruction card replaces this button.
 * The action's refusals are actionable by design (a live attempt names
 * its reference; an under-review attempt says so) — the house toast
 * helper stays silent on validation errors (it assumes inline form
 * feedback), and this button has no inline surface, so the message is
 * toasted here instead of being swallowed.
 *
 * The LABEL is the caller's call (issue 11): a subscriber whose period
 * is still running is offered "Extend by 1 month" instead of a plain
 * Subscribe — the click starts the same payment attempt, because an
 * approved renewal stacks onto the current period end anyway (issue
 * 07). Only the words differ; the action, the flow and the refusal
 * messages are shared.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { requestPaymentInstructions } from '@/actions/subscribe'
import { handleActionResult, handleMutationError, toast } from '@/lib/toast'

export function SubscribeButton({ label = 'Subscribe' }: { label?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSubscribe() {
    startTransition(async () => {
      try {
        const result = await requestPaymentInstructions()

        handleActionResult(result, {
          successMessage: 'Payment instructions ready',
          onSuccess: () => router.refresh(),
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
    <Button onClick={handleSubscribe} disabled={isPending}>
      {isPending ? 'Starting…' : label}
    </Button>
  )
}
