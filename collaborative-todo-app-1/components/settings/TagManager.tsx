'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { createTag, deleteTag } from '@/actions/tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from 'sonner'

interface Tag {
  id: string
  name: string
  color: string
}

interface TagManagerProps {
  boardId: string
  tags: Tag[]
}

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
]

export function TagManager({ boardId, tags }: TagManagerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [nameError, setNameError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const createMutation = useMutation({
    mutationFn: () => createTag({ boardId, name, color }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        toast.success('Tag created')
        setName('')
        setColor(PRESET_COLORS[0])
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
      toast.error('Failed to create tag')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => deleteTag(tagId),
    onSuccess: (result) => {
      if (result.success) {
        setDeleteTarget(null)
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) })
        toast.success('Tag deleted')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to delete tag')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setNameError('')

    if (!name.trim()) {
      setNameError('Tag name is required')
      return
    }

    createMutation.mutate()
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3">Tags</h3>

      {/* Existing tags */}
      <div className="space-y-2 mb-4">
        {tags.length === 0 && (
          <p className="text-sm text-gray-500">No tags yet. Create one below.</p>
        )}
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm text-gray-900">{tag.name}</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget(tag)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? Todos with this tag will keep their
              other tags.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete tag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create new tag form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="tag-name">Name</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (nameError) setNameError('')
            }}
            placeholder="e.g. Bug, Feature, Urgent"
            maxLength={50}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'tag-name-error' : undefined}
          />
          {nameError && (
            <p id="tag-name-error" className="text-sm text-destructive">
              {nameError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((presetColor) => (
              <Button
                key={presetColor}
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Select color ${presetColor}`}
                aria-pressed={color === presetColor}
                onClick={() => setColor(presetColor)}
                className={`rounded-full ${
                  color === presetColor
                    ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          size="sm"
        >
          {createMutation.isPending ? 'Creating...' : 'Add Tag'}
        </Button>
      </form>
    </div>
  )
}
