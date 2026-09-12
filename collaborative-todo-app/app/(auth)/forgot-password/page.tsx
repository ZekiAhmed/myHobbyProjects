// Step 1 of the password-reset flow: collect the email, ask Better Auth to
// send a reset link. We ALWAYS show the same success message regardless of
// whether the email actually belongs to an account — this prevents an
// attacker from using this form to discover which emails are registered
// (a subtle but important security detail).

'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from "@/components/ui/button";
import {Input} from "@/components/ui/input"
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    // We deliberately ignore the result here (success or "user not found")
    // — see the comment above about not leaking account existence.
    await authClient.requestPasswordReset({
      email,
      redirectTo: '/reset-password',
    })

    setIsSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return <p>If an account exists for {email}, we've sent a password reset link.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Forgot your password?</h1>
      <div className="grid gap-2">
  <Label htmlFor="name">Email</Label>
  <Input
    id="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
  />
</div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  )
}