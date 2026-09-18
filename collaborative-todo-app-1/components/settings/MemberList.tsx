'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { removeMember, leaveBoard } from '@/app/actions/members'
import { toast } from 'sonner'

type Member = {
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

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeMember(boardId, userId),
    onSuccess: (result) => {
      if (result.success) {
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

  const allMembers = [
    { ...owner, joinedAt: null, isOwner: true },
    ...members.map((m) => ({ ...m.user, joinedAt: m.joinedAt, isOwner: false })),
  ]

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Members</h3>
      <div className="space-y-2">
        {allMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {member.name}
                  {member.isOwner && (
                    <span className="ml-2 text-xs text-gray-500">(Owner)</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{member.email}</p>
              </div>
            </div>

            {isOwner && !member.isOwner && member.id !== currentUserId && (
              <button
                onClick={() => removeMemberMutation.mutate(member.id)}
                disabled={removeMemberMutation.isPending}
                className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                {removeMemberMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>

      {!isOwner && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => leaveBoardMutation.mutate()}
            disabled={leaveBoardMutation.isPending}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {leaveBoardMutation.isPending ? 'Leaving...' : 'Leave board'}
          </button>
        </div>
      )}
    </div>
  )
}
