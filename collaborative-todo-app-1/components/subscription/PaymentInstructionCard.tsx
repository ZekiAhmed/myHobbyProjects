'use client'

/**
 * @fileoverview Payment instruction card shown after Subscribe
 * (subscription-billing issues 04 + 05)
 *
 * Everything a manual bank transfer needs without leaving the app
 * (spec user stories 2–6): the exact amount (snapshotted at creation),
 * the bank details, a unique payment reference with a
 * copy-to-clipboard chip, the memo nudge that makes review fast, when
 * the attempt expires — and (issue 05) the receipt upload form that
 * flips the attempt to PENDING.
 *
 * The amount comes from the attempt's snapshot, never the live price —
 * the admin can edit pricing mid-flight without moving the goalposts
 * on a transfer already on its way (spec §Money).
 */

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ReceiptUploadForm } from '@/components/subscription/ReceiptUploadForm'
import type { PricingSettingsInput } from '@/lib/pricing-settings-schema'
import type { PaymentSubmission } from '@/lib/generated/prisma/browser'

/** The slice of a submission the card renders (status lives on the screen). */
type PaymentInstructionData = Pick<
  PaymentSubmission,
  'reference' | 'priceSnapshot' | 'currencySnapshot' | 'expiresAt'
>

interface PaymentInstructionCardProps {
  submission: PaymentInstructionData
  settings: PricingSettingsInput
}

export function PaymentInstructionCard({ submission, settings }: PaymentInstructionCardProps) {
  const [copied, setCopied] = useState(false)

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(submission.reference)
      setCopied(true)
      toast.success('Payment reference copied')
    } catch {
      // clipboard can be unavailable (insecure context, denied
      // permission) — tell the user instead of failing silently
      toast.error('Could not copy automatically — select the reference and copy it manually')
    }
  }

  return (
    <section className="rounded-lg border p-4" aria-labelledby="payment-instructions-heading">
      <h2 id="payment-instructions-heading" className="font-semibold">
        Payment instructions
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        Transfer exactly{' '}
        <span className="font-semibold text-foreground">
          {submission.priceSnapshot} {submission.currencySnapshot}
        </span>{' '}
        — this amount is locked to your attempt, so a later price change never affects it.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Your payment reference:</span>
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">{submission.reference}</code>
        <Button
          variant="outline"
          size="sm"
          onClick={copyReference}
          aria-label="Copy payment reference"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="mt-2 text-sm font-medium">
        Include {submission.reference} in the transfer memo — it is how your payment is matched
        to your account.
      </p>

      <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Account holder</dt>
          <dd className="font-medium sm:mt-0.5">{settings.accountHolder}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Account number</dt>
          <dd className="font-medium sm:mt-0.5">{settings.accountNumber}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Bank name</dt>
          <dd className="font-medium sm:mt-0.5">{settings.bankName}</dd>
        </div>
      </dl>

      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {settings.transferInstructions}
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        This attempt expires on {format(submission.expiresAt, 'd MMM yyyy, HH:mm')} if no
        receipt is uploaded — after that you can start again at any time.
      </p>

      <ReceiptUploadForm reference={submission.reference} />
    </section>
  )
}
