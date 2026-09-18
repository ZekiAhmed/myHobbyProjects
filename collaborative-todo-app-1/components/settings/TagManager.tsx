'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { createTag, deleteTag } from '@/actions/tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const handleDelete = (tagId: string) => {
    if (confirm('Delete this tag? Todos with this tag will keep their other tags.')) {
      deleteMutation.mutate(tagId)
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Tags</h3>

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
            <button
              onClick={() => handleDelete(tag.id)}
              disabled={deleteMutation.isPending}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

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
              <button
                key={presetColor}
                type="button"
                onClick={() => setColor(presetColor)}
                className={`h-6 w-6 rounded-full transition-transform ${
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
