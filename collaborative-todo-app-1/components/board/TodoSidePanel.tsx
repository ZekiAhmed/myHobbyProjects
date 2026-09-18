'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { createTodo, updateTodo, deleteTodo } from '@/actions/todos'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Todo } from '@/lib/generated/prisma/browser'
import type { TodoWithRelations } from '@/lib/types'

interface BoardMember {
  id: string
  name: string
  email: string
  image: string | null
}

interface BoardTag {
  id: string
  name: string
  color: string
}

interface TodoSidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  todo?: TodoWithRelations | null
  members: BoardMember[]
  tags: BoardTag[]
}

export function TodoSidePanel({
  open,
  onOpenChange,
  boardId,
  todo,
  members,
  tags,
}: TodoSidePanelProps) {
  const queryClient = useQueryClient()
  const isEditing = !!todo

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'TO_DO' | 'IN_PROGRESS' | 'DONE'>('TO_DO')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [titleError, setTitleError] = useState('')

  useEffect(() => {
    if (todo) {
      setTitle(todo.title)
      setDescription(todo.description || '')
      setStatus(todo.status)
      setPriority(todo.priority)
      setDueDate(todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '')
      setAssigneeId(todo.assigneeId || 'none')
      setSelectedTagIds(todo.tags.map((t) => t.tag.id))
    } else {
      setTitle('')
      setDescription('')
      setStatus('TO_DO')
      setPriority('MEDIUM')
      setDueDate('')
      setAssigneeId('none')
      setSelectedTagIds([])
    }
    setTitleError('')
  }, [todo, open])

  const createMutation = useMutation({
    mutationFn: () =>
      createTodo({
        boardId,
        title,
        description: description || undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigneeId: assigneeId === 'none' ? undefined : assigneeId,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
        toast.success('Todo created')
        onOpenChange(false)
      } else {
        if (result.error.type === 'validation') {
          setTitleError(result.error.message)
        } else {
          toast.error(result.error.message)
        }
      }
    },
    onError: () => {
      toast.error('Failed to create todo')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTodo(todo!.id, {
        title,
        description: description || undefined,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        assigneeId: assigneeId === 'none' ? null : assigneeId,
        tagIds: selectedTagIds,
      }),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
        toast.success('Todo updated')
        onOpenChange(false)
      } else {
        if (result.error.type === 'validation') {
          setTitleError(result.error.message)
        } else {
          toast.error(result.error.message)
        }
      }
    },
    onError: () => {
      toast.error('Failed to update todo')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTodo(todo!.id),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
        toast.success('Todo deleted')
        onOpenChange(false)
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to delete todo')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setTitleError('')

    if (!title.trim()) {
      setTitleError('Title is required')
      return
    }

    if (isEditing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this todo?')) {
      deleteMutation.mutate()
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Todo' : 'Create Todo'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update the todo details below.' : 'Add a new todo to the board.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (titleError) setTitleError('')
              }}
              placeholder="Enter todo title..."
              required
              aria-invalid={!!titleError}
              aria-describedby={titleError ? 'title-error' : undefined}
            />
            {titleError && (
              <p id="title-error" className="text-sm text-destructive">
                {titleError}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TO_DO">To Do</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v || 'none')}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'ring-2 ring-primary'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <SheetFooter>
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
                className="mr-auto"
              >
                Delete Todo
              </Button>
            )}
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
