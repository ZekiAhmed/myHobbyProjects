'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys } from '@/lib/queries/board-keys'
import { createTodo, updateTodo, deleteTodo } from '@/actions/todos'
import { CommentFeed } from '@/components/board/CommentFeed'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import { format } from 'date-fns'
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
  /** Signed-in user — Comment feed shows Edit only on their own Comments */
  currentUserId: string
  /** Board Owner — Comment feed shows Delete on any Comment (ADR-0001) */
  isOwner: boolean
  /**
   * Locked Board (issue 09): the panel becomes a read-only view. The
   * Todo stays fully readable — nothing is hidden — but there is no
   * form, no Delete control, and no comment composer to press.
   */
  readOnly?: boolean
}

export function TodoSidePanel({
  open,
  onOpenChange,
  boardId,
  todo,
  members,
  tags,
  currentUserId,
  isOwner,
  readOnly = false,
}: TodoSidePanelProps) {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const isEditing = !!todo

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'TO_DO' | 'IN_PROGRESS' | 'DONE'>('TO_DO')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState<string>('none')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [titleError, setTitleError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sync form fields from the selected todo (or reset for create mode).
  // Adjusted during render per https://react.dev/learn/you-might-not-need-an-effect
  const formSyncKey = `${open ? 'open' : 'closed'}:${todo?.id ?? 'create'}`
  const [prevFormSyncKey, setPrevFormSyncKey] = useState(formSyncKey)
  if (formSyncKey !== prevFormSyncKey) {
    setPrevFormSyncKey(formSyncKey)
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
  }

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
        setShowDeleteConfirm(false)
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

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  /**
   * Locked Board (issue 09): every field the form would have edited is
   * still on show — the Board is read-only, never empty — but there is
   * nothing here that can write.
   */
  const readOnlyContent = todo ? (
    <>
      <div className="flex flex-col gap-4 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</p>
          <p className="text-base font-medium">{todo.title}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
          <p className="text-sm whitespace-pre-wrap break-words">
            {todo.description || 'No description'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="text-sm">
              {todo.status === 'TO_DO'
                ? 'To Do'
                : todo.status === 'IN_PROGRESS'
                  ? 'In Progress'
                  : 'Done'}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</dt>
            <dd className="text-sm">{todo.priority.charAt(0) + todo.priority.slice(1).toLowerCase()}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due Date</dt>
            <dd className="text-sm">
              {todo.dueDate ? format(new Date(todo.dueDate), 'MMM d, yyyy') : 'None'}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Assignee</dt>
            <dd className="text-sm">{todo.assignee?.name || 'Unassigned'}</dd>
          </div>
        </dl>

        {todo.tags.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {todo.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Read-only — editing resumes once this board&apos;s subscription is renewed.
        </p>
      </div>

      <CommentFeed
        key={todo.id}
        boardId={boardId}
        todoId={todo.id}
        currentUserId={currentUserId}
        isOwner={isOwner}
        readOnly
      />
    </>
  ) : null

  const formContent = (
    <>
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
                  aria-pressed={selectedTagIds.includes(tag.id)}
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

        {isEditing ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
            className="w-full sm:w-auto sm:mr-auto"
          >
            Delete Todo
          </Button>
        ) : null}
        <Button type="submit" disabled={isPending || !title.trim()} className="w-full">
          {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
        </Button>
      </form>

      {isEditing ? (
        <CommentFeed
          key={todo.id}
          boardId={boardId}
          todoId={todo.id}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      ) : null}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete todo?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>&ldquo;{todo?.title}&rdquo;</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete todo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  // Mobile: full-screen dialog
  const panelTitle = readOnly ? todo?.title : isEditing ? 'Edit Todo' : 'Create Todo'
  const panelDescription = readOnly
    ? 'Read-only view of this todo.'
    : isEditing
      ? 'Update the todo details below.'
      : 'Add a new todo to the board.'

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-full h-[100dvh] sm:max-w-sm sm:h-auto sm:rounded-xl rounded-none top-0 left-0 -translate-x-0 -translate-y-0 flex flex-col p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{panelTitle}</DialogTitle>
            <DialogDescription>{panelDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {readOnly ? readOnlyContent : formContent}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Desktop: slide-in sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{panelTitle}</SheetTitle>
          <SheetDescription>{panelDescription}</SheetDescription>
        </SheetHeader>
        {readOnly ? readOnlyContent : formContent}
      </SheetContent>
    </Sheet>
  )
}
