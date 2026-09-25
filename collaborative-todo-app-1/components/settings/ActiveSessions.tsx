'use client'

import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionKeys } from '@/lib/queries/board-keys'
import { listActiveSessions, revokeSession, revokeOtherSessions } from '@/actions/sessions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

function formatTimestamp(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function SessionsCard({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 ring-1 ring-foreground/10">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Active sessions</h3>
          <p className="text-sm text-gray-500">
            These Active sessions are where your account is signed in.
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ActiveSessions() {
  const queryClient = useQueryClient()
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  const sessionsQuery = useQuery({
    queryKey: sessionKeys.all(),
    queryFn: async () => {
      const result = await listActiveSessions()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: sessionKeys.all() })

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: (result) => {
      if (result.success) {
        refresh()
        toast.success('Session signed out')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to sign out session')
    },
  })

  const bulkMutation = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: (result) => {
      if (result.success) {
        setShowBulkConfirm(false)
        refresh()
        toast.success(
          result.data.count === 1
            ? 'Signed out 1 other session'
            : `Signed out ${result.data.count} other sessions`
        )
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to sign out other sessions')
    },
  })

  if (sessionsQuery.isLoading) {
    return (
      <SessionsCard>
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </SessionsCard>
    )
  }

  if (sessionsQuery.isError) {
    return (
      <SessionsCard>
        <p className="mb-3 text-sm text-destructive">Could not load your active sessions.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sessionsQuery.refetch()}
          disabled={sessionsQuery.isFetching}
        >
          {sessionsQuery.isFetching ? 'Retrying...' : 'Try again'}
        </Button>
      </SessionsCard>
    )
  }

  const sessions = sessionsQuery.data ?? []
  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <>
      <SessionsCard
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkConfirm(true)}
            disabled={otherCount === 0 || bulkMutation.isPending}
          >
            Sign out all other sessions
          </Button>
        }
      >
        <div className="space-y-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-gray-50"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className="truncate">{s.device}</span>
                  {s.isCurrent && <Badge variant="secondary">This device</Badge>}
                </p>
                <p className="text-xs text-gray-500">
                  {s.ip} &middot; Signed in {formatTimestamp(s.createdAt)} &middot; Expires{' '}
                  {formatTimestamp(s.expiresAt)}
                </p>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revokeMutation.mutate(s.id)}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending && revokeMutation.variables === s.id
                    ? 'Signing out...'
                    : 'Sign out'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </SessionsCard>

      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out all other sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              Every other Active session will be signed out on its next request. You stay
              signed in here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending ? 'Signing out...' : 'Sign out all other sessions'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
