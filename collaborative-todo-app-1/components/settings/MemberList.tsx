'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { removeMember, leaveBoard } from '@/app/actions/members'
import { toast } from 'sonner'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
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

export type Member = {
  id: string
  name: string
  email: string
  image: string | null
}

type BoardMember = {
  userId: string
  joinedAt: Date
  user: Member
}

export type BoardMemberRow = BoardMember

export type MemberRow = Member & {
  joinedAt: Date | null
  isOwner: boolean
}

/**
 * Build the flat row list rendered by MemberList (owner first, then members).
 * Exported for tests — React keys are row.id, so ids MUST be unique.
 *
 * WHY DEDUPE: transferOwnership only updates Board.ownerId and leaves the
 * new owner's BoardMember row in place, so owner can appear in `members`.
 * Rendering both produced React's "two children with the same key" error.
 */
export function buildMemberRows(owner: Member, members: BoardMember[]): MemberRow[] {
  const ownerRow: MemberRow = { ...owner, joinedAt: null, isOwner: true }
  const seen = new Set<string>([owner.id])
  const memberRows: MemberRow[] = []
  for (const m of members) {
    if (seen.has(m.user.id)) continue
    seen.add(m.user.id)
    memberRows.push({ ...m.user, joinedAt: m.joinedAt, isOwner: false })
  }
  return [ownerRow, ...memberRows]
}

interface MemberListProps {
  boardId: string
  currentUserId: string
  isOwner: boolean
  members: BoardMember[]
  owner: Member
}

export function MemberList({
  boardId,
  currentUserId,
  isOwner,
  members,
  owner,
}: MemberListProps) {
  const queryClient = useQueryClient()
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeMember(boardId, userId),
    onSuccess: (result) => {
      if (result.success) {
        setRemoveTarget(null)
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        toast.success('Member removed')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to remove member')
    },
  })

  const leaveBoardMutation = useMutation({
    mutationFn: () => leaveBoard(boardId),
    onSuccess: (result) => {
      if (result.success) {
        setShowLeaveConfirm(false)
        queryClient.invalidateQueries({ queryKey: boardKeys.all() })
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        toast.success('Left board')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to leave board')
    },
  })

  const allMembers = buildMemberRows(owner, members)

  return (
    <div>
      <h3 className="text-xl font-semibold text-foreground mb-3">Members</h3>
      <div className="space-y-2">
        {allMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                {member.image && <AvatarImage src={member.image} alt={member.name} />}
                <AvatarFallback className="bg-primary/10 font-medium text-primary">
                  {member.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.name}
                  {member.isOwner && (
                    <span className="ml-2 text-xs text-muted-foreground">(Owner)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>

            {isOwner && !member.isOwner && member.id !== currentUserId && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setRemoveTarget({ id: member.id, name: member.name })}
                disabled={removeMemberMutation.isPending}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      {!isOwner && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowLeaveConfirm(true)}
            disabled={leaveBoardMutation.isPending}
          >
            Leave board
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.name}</strong> from this board? Todos assigned to
              them will become unassigned. They can be re-invited later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removeTarget) removeMemberMutation.mutate(removeTarget.id)
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? 'Removing...' : 'Remove member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave board?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this board and its todos. Ask the owner to re-invite you
              if you need access again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => leaveBoardMutation.mutate()}
              disabled={leaveBoardMutation.isPending}
            >
              {leaveBoardMutation.isPending ? 'Leaving...' : 'Leave board'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
