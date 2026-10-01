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
import type { TodoWithRelations } from '@/lib/types'

interface TodoCardProps {
  todo: TodoWithRelations
  isActive: boolean
  isOverlay?: boolean
  /** Locked Board (issue 09): not draggable, no quick-complete */
  readOnly?: boolean
  onQuickComplete?: (todoId: string) => void
  onClick?: (todo: TodoWithRelations) => void
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
    return { text: 'Today', className: 'text-amber-700' }
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
 * @param readOnly - Locked Board (issue 09): the card stays clickable so
 *   the Todo can be read, but it will not drag and offers no write control
 */
export function TodoCard({ todo, isActive, isOverlay = false, readOnly = false, onQuickComplete, onClick }: TodoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id, disabled: readOnly })

  const style = isOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  const priorityInfo = getPriorityInfo(todo.priority)
  const dueDateInfo = getDueDateInfo(todo.dueDate)

  const handleQuickComplete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onQuickComplete?.(todo.id)
  }

  const handleClick = () => {
    if (!isDragging) {
      onClick?.(todo)
    }
  }

  // Enter opens the todo; Space stays with dnd-kit as the drag lift.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.target === e.currentTarget && !isDragging) {
        e.preventDefault()
        e.stopPropagation()
        onClick?.(todo)
      }
      return
    }
    listeners?.onKeyDown?.(e)
  }

  const cardProps = isOverlay
    ? {}
    : { ref: setNodeRef, style, ...attributes, ...listeners }

  // A locked Board's card reads like any other — it simply has nothing
  // to drag with and no quick-complete control to click (issue 09).
  const quickComplete = readOnly ? undefined : onQuickComplete
  const cursorClass = readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'

  return (
    <Card
      {...cardProps}
      className={`${cursorClass} transition-shadow ${
        isDragging && !isOverlay ? 'opacity-50 shadow-lg' : ''
      } ${isActive ? 'ring-2 ring-primary' : ''} ${
        isOverlay ? 'shadow-xl rotate-2' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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

        {/* Footer: Priority, Due Date, Assignee, Quick Complete */}
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

          <div className="flex items-center gap-2">
            {/* Quick complete button */}
            {quickComplete && (
              <button
                type="button"
                onClick={handleQuickComplete}
                className={`p-1.5 rounded-full transition-colors ${
                  todo.status === 'DONE'
                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
                aria-label={todo.status === 'DONE' ? 'Mark as incomplete' : 'Mark as complete'}
                title={todo.status === 'DONE' ? 'Mark as incomplete' : 'Mark as complete'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )}

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
      </div>
    </Card>
  )
}
