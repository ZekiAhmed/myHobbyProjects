'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys, invitationsQueryOptions } from '@/lib/queries/board-keys'
import { createInvitation, revokeInvitation } from '@/app/actions/invitations'
import { toast } from 'sonner'

interface InviteFormProps {
  boardId: string
}

export function InviteForm({ boardId }: InviteFormProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const { data: invitations = [] } = useQuery(invitationsQueryOptions(boardId))

  const inviteMutation = useMutation({
    mutationFn: (inviteEmail: string) => createInvitation(boardId, inviteEmail),
    onMutate: () => {
      setEmailError('')
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success('Invitation sent!')
        setEmail('')
        setEmailError('')
        queryClient.invalidateQueries({ queryKey: boardKeys.invitations(boardId) })
      } else {
        if (result.error.type === 'validation') {
          setEmailError(result.error.message)
        } else if (result.error.type === 'authorization') {
          toast.error(result.error.message)
        } else {
          toast.error(result.error.message)
        }
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
      <h3 className="text-sm font-medium text-gray-900 mb-3">Invite by email</h3>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="flex-1 space-y-1">
          <input
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {emailError && (
            <p id="email-error" className="text-sm text-destructive">
              {emailError}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={inviteMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {inviteMutation.isPending ? 'Sending...' : 'Invite'}
        </button>
      </form>

      {invitations.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
            Pending invitations
          </h4>
          <div className="space-y-2">
            {invitations.map((invitation: { id: string; email: string; expiresAt: string }) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-2 rounded-md bg-gray-50"
              >
                <div>
                  <p className="text-sm text-gray-900">{invitation.email}</p>
                  <p className="text-xs text-gray-500">
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeMutation.mutate(invitation.id)}
                  disabled={revokeMutation.isPending}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
