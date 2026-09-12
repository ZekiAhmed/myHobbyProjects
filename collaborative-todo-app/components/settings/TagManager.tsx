// Owner-only tag CRUD. Note the @@unique([listId, name]) database
// constraint means createTag() can throw a "duplicate name" error, which
// we catch and show inline rather than letting it bubble up as an
// unhandled exception.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTag, deleteTag } from '@/actions/tags'
import { Input} from '@/components/ui/input'
import {Button } from '@/components/ui/button'
import { Label } from '../ui/label'

type Tag = { id: string; name: string; color: string }

export function TagManager({ listId, tags }: { listId: string; tags: Tag[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3B82F6')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      await createTag(listId, name, color)
      setName('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(tagId: string) {
    if (!confirm('Delete this tag? It will be removed from every todo.')) return
    await deleteTag(tagId)
    router.refresh()
  }

  return (
    <div>
      <ul>
        {tags.map((tag) => (
          <li key={tag.id}>
            <span style={{ backgroundColor: tag.color }}>{tag.name}</span>
            <Button variant="destructive" onClick={() => handleDelete(tag.id)}>
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className="space-y-4">
  {error && (
    <p role="alert" className="text-sm font-medium text-destructive">
      {error}
    </p>
  )}

  {/* Tag Name Input */}
  <div className="grid gap-2">
    <Label htmlFor="tag-name">New tag name</Label>
    <Input
      id="tag-name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="e.g. Bug, Feature, Urgent"
    />
  </div>

  {/* Tag Color Picker */}
  <div className="grid gap-2">
    <Label htmlFor="tag-color">Tag color</Label>
    <div className="flex items-center gap-3">
      <input
        id="tag-color"
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Tag color"
        className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1 shadow-xs transition-colors"
      />
      <span className="text-xs text-muted-foreground uppercase">{color}</span>
    </div>
  </div>

  {/* Submit Button */}
  <Button type="submit" disabled={isSubmitting || !name.trim()} className="w-full">
    {isSubmitting ? 'Adding…' : 'Add Tag'}
  </Button>
</form>
    </div>
  )
}