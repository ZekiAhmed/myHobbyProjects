'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { renameBoard, deleteBoard, transferOwnership } from '@/app/actions/boards'
import { MemberList } from '@/components/settings/MemberList'
import { InviteForm } from '@/components/settings/InviteForm'
import { TagManager } from '@/components/settings/TagManager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type Tag = {
  id: string
  name: string
  color: string
}

interface BoardSettingsClientProps {
  boardId: string
  boardName: string
  owner: Member
  members: BoardMember[]
  tags: Tag[]
  currentUserId: string
}

export function BoardSettingsClient({
  boardId,
  boardName,
  owner,
  members,
  tags,
  currentUserId,
}: BoardSettingsClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Rename state
  const [name, setName] = useState(boardName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameError, setNameError] = useState('')

  // Transfer ownership state
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)

  // Delete board state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: () => renameBoard(boardId, name),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        queryClient.invalidateQueries({ queryKey: boardKeys.all() })
        toast.success('Board renamed')
        setIsEditingName(false)
        setNameError('')
      } else {
        if (result.error.type === 'validation') {
          setNameError(result.error.message)
        } else if (result.error.type === 'authorization') {
          toast.error(result.error.message)
        } else {
          toast.error(result.error.message)
        }
      }
    },
    onError: () => {
      toast.error('Failed to rename board')
    },
  })

  // Delete board mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteBoard(boardId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.all() })
        toast.success('Board deleted')
        router.push('/')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to delete board')
    },
  })

  // Transfer ownership mutation
  const transferMutation = useMutation({
    mutationFn: () => transferOwnership(boardId, selectedMemberId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        queryClient.invalidateQueries({ queryKey: boardKeys.all() })
        toast.success('Ownership transferred')
        router.push(`/boards/${boardId}`)
      } else {
        if (result.error.type === 'validation') {
          toast.error(result.error.message)
        } else if (result.error.type === 'authorization') {
          toast.error(result.error.message)
        } else {
          toast.error(result.error.message)
        }
      }
    },
    onError: () => {
      toast.error('Failed to transfer ownership')
    },
  })

  const handleRename = () => {
    setNameError('')
    if (name.trim() && name !== boardName) {
      renameMutation.mutate()
    } else {
      setIsEditingName(false)
      setName(boardName)
    }
  }

  const handleDelete = () => {
    if (deleteConfirmText === boardName) {
      deleteMutation.mutate()
    }
  }

  const handleTransfer = () => {
    if (selectedMemberId) {
      transferMutation.mutate()
    }
  }

  // Get all members except the current owner for transfer dropdown
  const transferableMembers = members
    .filter((m) => m.userId !== currentUserId)
    .map((m) => m.user)

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Board Settings</h1>

      <div className="space-y-8">
        {/* Rename Section */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Board Name</h3>
          {isEditingName ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError('')
                  }}
                  placeholder="Board name"
                  maxLength={100}
                  className="flex-1"
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? 'name-error' : undefined}
                />
                <Button
                  onClick={handleRename}
                  disabled={renameMutation.isPending || !name.trim()}
                  size="sm"
                >
                  {renameMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditingName(false)
                    setName(boardName)
                    setNameError('')
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              {nameError && (
                <p id="name-error" className="text-sm text-destructive">
                  {nameError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-gray-900">{boardName}</p>
              <Button
                onClick={() => setIsEditingName(true)}
                variant="outline"
                size="sm"
              >
                Rename
              </Button>
            </div>
          )}
        </section>

        {/* Member Management */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <MemberList
            boardId={boardId}
            currentUserId={currentUserId}
            isOwner={true}
            members={members}
            owner={owner}
          />
        </section>

        {/* Invite Form */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <InviteForm boardId={boardId} />
        </section>

        {/* Tag Management */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <TagManager boardId={boardId} tags={tags} />
        </section>

        {/* Transfer Ownership Section */}
        {transferableMembers.length > 0 && (
          <section className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Transfer Ownership</h3>
            <p className="text-sm text-gray-500 mb-4">
              Transfer board ownership to another member. You will become a regular member and lose settings access.
            </p>

            {showTransferConfirm ? (
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Are you sure you want to transfer ownership to{' '}
                    <strong>
                      {transferableMembers.find((m) => m.id === selectedMemberId)?.name}
                    </strong>
                    ? You will lose settings access.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleTransfer}
                    disabled={transferMutation.isPending}
                    variant="destructive"
                    size="sm"
                  >
                    {transferMutation.isPending ? 'Transferring...' : 'Confirm Transfer'}
                  </Button>
                  <Button
                    onClick={() => setShowTransferConfirm(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select a member</option>
                  {transferableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => {
                    if (selectedMemberId) {
                      setShowTransferConfirm(true)
                    }
                  }}
                  disabled={!selectedMemberId}
                  variant="outline"
                  size="sm"
                >
                  Transfer
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Danger Zone */}
        <section className="bg-white rounded-lg border border-red-200 p-6">
          <h3 className="text-sm font-medium text-red-900 mb-3">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete this board and all its data. This action cannot be undone.
          </p>

          {showDeleteConfirm ? (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">
                  Type <strong>{boardName}</strong> to confirm deletion:
                </p>
              </div>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Enter board name"
                className="max-w-sm"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || deleteConfirmText !== boardName}
                  variant="destructive"
                  size="sm"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Board'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              size="sm"
            >
              Delete Board
            </Button>
          )}
        </section>
      </div>
    </div>
  )
}
