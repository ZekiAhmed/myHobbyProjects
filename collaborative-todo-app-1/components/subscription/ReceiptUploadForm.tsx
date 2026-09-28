'use client'

/**
 * @fileoverview Receipt upload form on the payment instruction card
 * (subscription-billing issue 05)
 *
 * The last step of a manual bank transfer: tick the memo attestation,
 * attach the receipt (JPEG/PNG/WebP/PDF ≤ 5 MB), submit it to the
 * upload route, and land on a definitive "submitted — under review"
 * state (story 11) so the user never wonders whether the proof arrived.
 *
 * The memo checkbox precedes upload: the reference in the transfer memo
 * is what makes review a five-second match, so the form makes the user
 * affirm it before the button comes alive.
 *
 * Validation is two-tier (story 9): the obvious size mistake is caught
 * here instantly with no network call; the authoritative signature
 * check happens server-side (spec §Receipt storage — never trust the
 * client's type) and any rejection is rendered inline, next to the
 * input the user can fix.
 */

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { billingKeys } from '@/lib/queries/board-keys'
import {
  RECEIPT_MAX_BYTES,
  RECEIPT_MIME_TYPES,
  RECEIPT_TOO_LARGE_ERROR,
} from '@/lib/receipt'

interface ReceiptUploadFormProps {
  reference: string
}

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'error'; message: string }
  | { phase: 'success' }

export function ReceiptUploadForm({ reference }: ReceiptUploadFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [memoConfirmed, setMemoConfirmed] = useState(false)
  const [state, setState] = useState<UploadState>({ phase: 'idle' })

  const canSubmit = Boolean(file) && memoConfirmed && state.phase !== 'uploading'

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setFile(selected)
    if (state.phase === 'error') setState({ phase: 'idle' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || !memoConfirmed) return

    if (file.size > RECEIPT_MAX_BYTES) {
      reportError(RECEIPT_TOO_LARGE_ERROR)
      return
    }

    setState({ phase: 'uploading' })

    const body = new FormData()
    body.append('reference', reference)
    body.append('file', file)

    try {
      const response = await fetch('/api/receipts', { method: 'POST', body })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        reportError(payload?.error ?? 'Upload failed — please try again')
        return
      }

      setState({ phase: 'success' })
      toast.success('Receipt submitted for review')
      // the attempt just flipped to PENDING: invalidate the billing reads
      // so the pending-review banner appears now, not at the query's next
      // focus/refetch trigger (subscription-billing issue 06)
      queryClient.invalidateQueries({ queryKey: billingKeys.all() })
      // flip the screen to the server-rendered "payment under review"
      // section — the definitive state, not just this component's view
      router.refresh()
    } catch {
      reportError('Upload failed — check your connection and try again')
    }
  }

  /** Inline message (story 9) + shared toast (spec §Conventions). */
  function reportError(message: string) {
    setState({ phase: 'error', message })
    toast.error(message)
  }

  if (state.phase === 'success') {
    return (
      <section
        className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950"
        aria-live="polite"
        data-testid="receipt-success"
      >
        <h3 className="font-semibold">Receipt submitted — under review</h3>
        <p className="mt-1 text-sm">
          Your payment for reference <code className="font-mono">{reference}</code> is in the
          review queue. You will be notified of the decision — no further action needed.
        </p>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t pt-4" noValidate>
      <h3 className="font-semibold">Upload your receipt</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        After transferring, upload the receipt your banking app exports (JPEG, PNG, WebP, or
        PDF — up to 5 MB).
      </p>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={memoConfirmed}
          onChange={(event) => setMemoConfirmed(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          I included <code className="font-mono">{reference}</code> in the transfer memo
        </span>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept={RECEIPT_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          aria-label="Receipt file"
        />
        <Button type="submit" disabled={!canSubmit}>
          {state.phase === 'uploading' ? 'Uploading…' : 'Submit receipt'}
        </Button>
      </div>

      {state.phase === 'error' && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {state.message}
        </p>
      )}
    </form>
  )
}
