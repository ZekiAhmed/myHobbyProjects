'use client'

/**
 * @fileoverview Subscribe button — starts a payment attempt
 * (subscription-billing issue 04)
 *
 * Calls the subscribe action, then refreshes the server-rendered
 * upgrade screen so the payment instruction card replaces this button.
 * The action's refusals are actionable by design (a live attempt names
 * its reference; an under-review attempt says so) — the house toast
 * helper stays silent on validation errors (it assumes inline form
 * feedback), and this button has no inline surface, so the message is
 * toasted here instead of being swallowed.
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { requestPaymentInstructions } from '@/actions/subscribe'
import { handleActionResult, handleMutationError, toast } from '@/lib/toast'

export function SubscribeButton() {
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
      {isPending ? 'Starting…' : 'Subscribe'}
    </Button>
  )
}
