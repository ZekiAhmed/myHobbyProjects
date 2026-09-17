/**
 * @fileoverview TodoCard Component
 *
 * This component renders a single todo item in the Kanban board.
 * It is draggable and displays todo information including title, priority, due date, assignee, and tags.
 *
 * FEATURES:
 * - Draggable via @dnd-kit/sortable
 * - Displays title, priority badge, due date, assignee avatar, and tag chips
 * - Click handler to open side panel (future feature)
 * - Visual feedback when being dragged
 *
 * @see https://dndkit.com/
 */

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { format, isPast, isToday } from 'date-fns'
import type { Todo } from '@/lib/generated/prisma/browser'

type TodoWithRelations = Todo & {
  assignee: { id: string; name: string; image: string | null } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

interface TodoCardProps {
  todo: TodoWithRelations
  isActive: boolean
}

/**
 * Get priority badge variant and label
 */
function getPriorityInfo(priority: string) {
  switch (priority) {
    case 'URGENT':
      return { variant: 'destructive' as const, label: 'Urgent' }
    case 'HIGH':
      return { variant: 'default' as const, label: 'High' }
    case 'MEDIUM':
      return { variant: 'secondary' as const, label: 'Medium' }
    case 'LOW':
      return { variant: 'outline' as const, label: 'Low' }
    default:
      return { variant: 'secondary' as const, label: priority }
  }
}

/**
 * Get due date styling based on urgency
 */
function getDueDateInfo(dueDate: Date | null) {
  if (!dueDate) return null
  
  const date = new Date(dueDate)
  
  if (isPast(date) && !isToday(date)) {
    return { text: format(date, 'MMM d'), className: 'text-red-600' }
  }
  if (isToday(date)) {
    return { text: 'Today', className: 'text-amber-600' }
  }
  return { text: format(date, 'MMM d'), className: 'text-muted-foreground' }
}

/**
 * Get initials from name
 */
function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * TodoCard — renders a single todo item
 *
 * WHAT IT DOES:
 * 1. Sets up drag-and-drop via useSortable
 * 2. Renders todo title, priority badge, due date, assignee, and tags
 * 3. Provides visual feedback when being dragged
 * 4. Handles click events (future: open side panel)
 *
 * @param todo - The todo data with relations
 * @param isActive - Whether this todo is currently being dragged
 */
export function TodoCard({ todo, isActive }: TodoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const priorityInfo = getPriorityInfo(todo.priority)
  const dueDateInfo = getDueDateInfo(todo.dueDate)

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      } ${isActive ? 'ring-2 ring-primary' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="p-3 space-y-2">
        {/* Title */}
        <p className="font-medium text-sm line-clamp-2">{todo.title}</p>

        {/* Tags */}
        {todo.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {todo.tags.map(({ tag }) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Priority, Due Date, Assignee */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Priority badge */}
            <Badge variant={priorityInfo.variant} className="text-xs">
              {priorityInfo.label}
            </Badge>

            {/* Due date */}
            {dueDateInfo && (
              <span className={`text-xs ${dueDateInfo.className}`}>
                {dueDateInfo.text}
              </span>
            )}
          </div>

          {/* Assignee avatar */}
          {todo.assignee && (
            <Avatar size="sm">
              <AvatarImage src={todo.assignee.image || undefined} />
              <AvatarFallback>
                {getInitials(todo.assignee.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  )
}
