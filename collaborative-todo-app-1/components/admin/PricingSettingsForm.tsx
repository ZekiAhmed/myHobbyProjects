'use client'

/**
 * @fileoverview Admin pricing & bank-details settings form
 * (subscription-billing issue 02)
 *
 * Rendered ONLY inside the /admin gate (requireAdmin) — the server
 * action re-checks the platform role anyway (defense in depth: an open
 * session that lost the role is refused with an authorization
 * ActionResult, not a write).
 *
 * UX contract:
 * - Fields start from the persisted values, so the Administrator edits
 *   what is actually stored
 * - Validation runs client-side first (shared zod schema — the same one
 *   the action uses, so the two can never drift) for inline errors
 *   before the round trip; the action validates authoritatively
 * - Refusals from the server surface as error toasts and keep the
 *   pre-refusal values (router.refresh only runs on success)
 */

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { savePricingSettings } from '@/actions/pricing-settings'
import { handleActionResult, handleMutationError } from '@/lib/toast'
import {
  PricingSettingsSchema,
  type PricingSettingsInput,
} from '@/lib/pricing-settings-schema'

interface PricingSettingsFormProps {
  settings: PricingSettingsInput
}

type FormState = Record<keyof PricingSettingsInput, string>
type FieldErrors = Partial<Record<keyof PricingSettingsInput, string>>

/** Form values → validated payload, plus per-field errors to render. */
function validate(values: FormState): {
  errors: FieldErrors
  payload?: PricingSettingsInput
} {
  // the raw price goes to the schema as-is: NaN from non-numeric input
  // and decimals both fail there, against one shared rule
  const parsed = PricingSettingsSchema.safeParse({
    ...values,
    price: Number(values.price.trim()),
  })

  if (parsed.success) {
    return { errors: {}, payload: parsed.data }
  }

  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof PricingSettingsInput
    if (key && !errors[key]) errors[key] = issue.message
  }

  return { errors }
}

export function PricingSettingsForm({ settings }: PricingSettingsFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [values, setValues] = useState<FormState>({
    price: String(settings.price),
    currency: settings.currency,
    accountHolder: settings.accountHolder,
    accountNumber: settings.accountNumber,
    bankName: settings.bankName,
    transferInstructions: settings.transferInstructions,
  })
  const [errors, setErrors] = useState<FieldErrors>({})

  function update(field: keyof FormState, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const { errors: nextErrors, payload } = validate(values)
    setErrors(nextErrors)
    if (!payload) return

    startTransition(async () => {
      try {
        const result = await savePricingSettings(payload)

        // house toast helpers (spec: "status feedback via sonner toasts
        // through the existing toast helpers")
        handleActionResult(result, {
          successMessage: 'Pricing settings saved',
          onSuccess: () => router.refresh(),
          onError: (error) => {
            // the helper stays silent on validation by design (inline
            // errors); this form's client pass makes that unreachable
            // from the UI, so surface it rather than fail silently
            if (error.type === 'validation') toast.error(error.message)
          },
        })
      } catch (error) {
        handleMutationError(error)
      }
    })
  }

  function errorFor(field: keyof FormState) {
    return errors[field] ? (
      <p id={`${field}-error`} className="text-sm text-destructive">
        {errors[field]}
      </p>
    ) : null
  }

  function fieldProps(field: keyof FormState) {
    return {
      id: field,
      name: field,
      value: values[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update(field, event.target.value),
      'aria-invalid': !!errors[field],
      'aria-describedby': errors[field] ? `${field}-error` : undefined,
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">Pricing &amp; bank details</h2>
      <p className="text-sm text-muted-foreground">
        The payment instruction subscribers see on the upgrade screen. Changes apply to new
        payment attempts; submissions already in flight keep their original amount.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="price" className="text-sm font-medium">
              Price (whole units)
            </label>
            <Input type="number" min={1} step={1} inputMode="numeric" {...fieldProps('price')} />
            {errorFor('price')}
          </div>

          <div className="space-y-1">
            <label htmlFor="currency" className="text-sm font-medium">
              Currency (3-letter code)
            </label>
            <Input maxLength={3} placeholder="ETB" {...fieldProps('currency')} />
            {errorFor('currency')}
          </div>

          <div className="space-y-1">
            <label htmlFor="accountHolder" className="text-sm font-medium">
              Account holder
            </label>
            <Input {...fieldProps('accountHolder')} />
            {errorFor('accountHolder')}
          </div>

          <div className="space-y-1">
            <label htmlFor="accountNumber" className="text-sm font-medium">
              Account number (6–15 digits)
            </label>
            <Input inputMode="numeric" {...fieldProps('accountNumber')} />
            {errorFor('accountNumber')}
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="bankName" className="text-sm font-medium">
              Bank name
            </label>
            <Input {...fieldProps('bankName')} />
            {errorFor('bankName')}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="transferInstructions" className="text-sm font-medium">
            Transfer instructions
          </label>
          <Textarea rows={3} {...fieldProps('transferInstructions')} />
          {errorFor('transferInstructions')}
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </section>
  )
}
