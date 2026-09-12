// One column (To Do / In Progress / Done). Wraps its cards in dnd-kit's
// SortableContext, which is what enables drag-and-drop reordering WITHIN
// this column (dragging ACROSS columns is handled by KanbanBoard's
// onDragEnd, using the `over.data` this column attaches to itself below).
//
// Implements PRD open question #1's recommended default: collapse the
// DONE column after 10 items with a "View all" expand toggle.

'use client'

import { useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { TodoCard } from './TodoCard'
import type { Todo, TodoStatus } from '@/lib/generated/prisma/client'

const DONE_COLLAPSE_THRESHOLD = 10

type KanbanColumnProps = {
  status: TodoStatus
  label: string
  todos: (Todo & {
    assignee: { id: string; name: string; image: string | null } | null
    tags: { tag: { id: string; name: string; color: string } }[]
  })[]
  onQuickComplete: (todoId: string) => void
  onOpenTodo: (todoId: string) => void
}

export function KanbanColumn({ status, label, todos, onQuickComplete, onOpenTodo }: KanbanColumnProps) {
  const [showAllDone, setShowAllDone] = useState(false)

  // useDroppable registers this whole column as a valid drop target for
  // dropping INTO AN EMPTY COLUMN (or below the last card). Its `data`
  // payload is read by KanbanBoard's handleDragEnd to know which column
  // and index a card was dropped into.
  const { setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status, index: todos.length },
  })

  const isDone = status === 'DONE'
  const shouldCollapse = isDone && !showAllDone && todos.length > DONE_COLLAPSE_THRESHOLD
  const visibleTodos = shouldCollapse ? todos.slice(0, DONE_COLLAPSE_THRESHOLD) : todos

  return (
    <div ref={setNodeRef} style={{ flex: 1, minWidth: 280 }}>
      <h2>
        {label} ({todos.length})
      </h2>

      {/* SortableContext's `items` list tells dnd-kit the current order —
          it needs this to calculate animations and drop positions as the
          user drags a card up/down within the column. */}
      <SortableContext items={visibleTodos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {visibleTodos.map((todo, index) => (
          <TodoCard
            key={todo.id}
            todo={todo}
            index={index}
            status={status}
            onQuickComplete={() => onQuickComplete(todo.id)}
            onOpen={() => onOpenTodo(todo.id)}
          />
        ))}
      </SortableContext>

      {shouldCollapse && (
        <button onClick={() => setShowAllDone(true)}>
          View all {todos.length} completed
        </button>
      )}
    </div>
  )
}