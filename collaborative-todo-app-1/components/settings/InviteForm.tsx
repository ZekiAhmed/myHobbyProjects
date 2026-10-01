'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys, invitationsQueryOptions } from '@/lib/queries/board-keys'
import { createInvitation, revokeInvitation } from '@/app/actions/invitations'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PaywallBanner } from '@/components/subscription/PaywallBanner'
import type { NotProReason } from '@/lib/subscription'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface InviteFormProps {
  boardId: string
}

export function InviteForm({ boardId }: InviteFormProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  // The paywall is only ever set from a REFUSED attempt — the paid
  // moment is the click, so nothing paywall-shaped shows before it
  // (subscription-billing issue 10).
  const [paywall, setPaywall] = useState<{ reason: NotProReason; message: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; email: string } | null>(null)

  const { data: invitations = [] } = useQuery(invitationsQueryOptions(boardId))

  const inviteMutation = useMutation({
    mutationFn: (inviteEmail: string) => createInvitation(boardId, inviteEmail),
    onMutate: () => {
      setEmailError('')
      setPaywall(null)
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Invitation sent!')
        setEmail('')
        setEmailError('')
        queryClient.invalidateQueries({ queryKey: boardKeys.invitations(boardId) })
      } else if (result.error.reason) {
        // The paywall: the server named WHY the Owner is not Pro, so
        // the banner pairs that message with the matching prompt
        // (upgrade vs renew) instead of a generic error toast.
        setPaywall({ reason: result.error.reason, message: result.error.message })
      } else if (result.error.type === 'validation') {
        setEmailError(result.error.message)
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to send invitation')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(invitationId),
    onSuccess: (result) => {
      if (result.success) {
        setRevokeTarget(null)
        toast.success('Invitation revoked')
        queryClient.invalidateQueries({ queryKey: boardKeys.invitations(boardId) })
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to revoke invitation')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }

    inviteMutation.mutate(email.trim())
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-foreground mb-3">Invite by email</h3>

      {paywall && <PaywallBanner reason={paywall.reason} message={paywall.message} />}

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="flex-1 space-y-1">
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError('')
            }}
            placeholder="colleague@example.com"
            required
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
          />
          {emailError && (
            <p id="email-error" className="text-sm text-destructive">
              {emailError}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={inviteMutation.isPending}
        >
          {inviteMutation.isPending ? 'Sending...' : 'Invite'}
        </Button>
      </form>

      {invitations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
            Pending invitations
          </h4>
          <div className="space-y-2">
            {invitations.map((invitation: { id: string; email: string; expiresAt: string }) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted"
              >
                <div>
                  <p className="text-sm text-foreground">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setRevokeTarget({ id: invitation.id, email: invitation.email })}
                  disabled={revokeMutation.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoke the pending invitation for <strong>{revokeTarget?.email}</strong>? The
              invite link will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
              }}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
