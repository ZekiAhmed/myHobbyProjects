/**
 * @fileoverview KanbanColumn Component
 *
 * This component renders a single column in the Kanban board.
 * It uses SortableContext from @dnd-kit/sortable for drag-and-drop reordering.
 *
 * FEATURES:
 * - SortableContext for drag-and-drop reordering
 * - Column header with title and todo count
 * - Collapsible DONE column (shows first 10, expand button for rest)
 * - Droppable area for todos
 *
 * @see https://dndkit.com/
 */

'use client'

import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { TodoCard } from '@/components/board/TodoCard'
import { Button } from '@/components/ui/button'
import type { Todo } from '@/lib/generated/prisma/browser'
import type { TodoWithRelations } from '@/lib/types'

interface KanbanColumnProps {
  id: string
  title: string
  todos: TodoWithRelations[]
  activeId: string | null
  collapsible?: boolean
  onQuickComplete?: (todoId: string) => void
  onTodoClick?: (todo: TodoWithRelations) => void
}

const MAX_VISIBLE_DONE = 10

/**
 * KanbanColumn — renders a single column in the Kanban board
 *
 * WHAT IT DOES:
 * 1. Sets up a droppable area for todos
 * 2. Renders a column header with title and todo count
 * 3. Renders TodoCard components for each todo
 * 4. Handles collapsible DONE column (shows first 10, expand for rest)
 *
 * @param id - Column ID (matches TodoStatus enum)
 * @param title - Display title for the column
 * @param todos - Array of todos in this column
 * @param activeId - ID of the todo being dragged (for visual feedback)
 * @param collapsible - Whether the column can be collapsed (DONE column)
 */
export function KanbanColumn({
  id,
  title,
  todos,
  activeId,
  collapsible = false,
  onQuickComplete,
  onTodoClick,
}: KanbanColumnProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Set up droppable area
  const { setNodeRef, isOver } = useDroppable({ id })

  // Calculate visible todos (for collapsible columns)
  const visibleTodos = collapsible && !isExpanded
    ? todos.slice(0, MAX_VISIBLE_DONE)
    : todos
  const hiddenCount = collapsible ? Math.max(0, todos.length - MAX_VISIBLE_DONE) : 0

  // Get column color based on status
  const getColumnColor = () => {
    switch (id) {
      case 'TO_DO':
        return 'bg-slate-100 border-slate-200'
      case 'IN_PROGRESS':
        return 'bg-blue-50 border-blue-200'
      case 'DONE':
        return 'bg-green-50 border-green-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div
      className={`flex flex-col w-full md:w-72 shrink-0 rounded-lg border ${getColumnColor()} ${
        isOver ? 'ring-2 ring-primary/50' : ''
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {todos.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 overflow-y-auto min-h-[200px]"
      >
        <SortableContext
          items={visibleTodos.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {visibleTodos.map((todo) => (
              <TodoCard
                key={todo.id}
                todo={todo}
                isActive={todo.id === activeId}
                onQuickComplete={onQuickComplete}
                onClick={onTodoClick}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {todos.length === 0 && (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            No todos
          </div>
        )}
      </div>

      {/* Expand/collapse button for DONE column */}
      {collapsible && hiddenCount > 0 && (
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded
              ? 'Show less'
              : `View all completed (${todos.length})`}
          </Button>
        </div>
      )}
    </div>
  )
}
