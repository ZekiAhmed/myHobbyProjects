/**
 * @fileoverview KanbanBoard Client Component
 *
 * This is a Client Component that renders the Kanban board with drag-and-drop.
 * It uses DndContext from @dnd-kit/core for drag-and-drop functionality.
 *
 * DATA FLOW:
 * 1. Server Component (page.tsx) prefetches board detail and todos
 * 2. Data is passed to this component via HydrationBoundary
 * 3. This component uses useQuery to read from the hydrated cache
 * 4. Polling every 8 seconds keeps data fresh
 *
 * ARCHITECTURE:
 * - DndContext wraps the entire board for drag-and-drop
 * - KanbanColumn renders each status column (To Do, In Progress, Done)
 * - TodoCard renders individual todo items
 * - FilterBar provides client-side filtering controls
 *
 * @see https://dndkit.com/
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { boardDetailQueryOptions, boardKeys, todosQueryOptions } from '@/lib/queries/board-keys'
import { KanbanColumn } from '@/components/board/KanbanColumn'
import { TodoCard } from '@/components/board/TodoCard'
import { FilterBar } from '@/components/board/FilterBar'
import { TodoSidePanel } from '@/components/board/TodoSidePanel'
import { Button } from '@/components/ui/button'
import { quickCompleteTodo, updateTodoStatusAndOrder } from '@/actions/todos'
import { toast } from 'sonner'
import { generateKeyBetween } from 'fractional-indexing'
import type { Todo, BoardMember, Tag } from '@/lib/generated/prisma/browser'
import type { TodoWithRelations, BoardDetail } from '@/lib/types'

/**
 * KanbanBoard — renders the Kanban board with drag-and-drop
 *
 * WHAT IT DOES:
 * 1. Fetches board detail and todos from the hydrated cache
 * 2. Sets up drag-and-drop sensors
 * 3. Handles drag start, over, and end events
 * 4. Renders three KanbanColumn components (To Do, In Progress, Done)
 * 5. Provides FilterBar for client-side filtering
 *
 * @param boardId - The ID of the board to display
 */
export function KanbanBoard({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient()
  
  // Filter state
  const [filters, setFilters] = useState({
    priority: [] as string[],
    assignee: [] as string[],
    tag: [] as string[],
    dueDate: null as string | null,
  })

  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<TodoWithRelations | null>(null)

  // Fetch board detail and todos
  const { data: board } = useQuery(boardDetailQueryOptions(boardId) as ReturnType<typeof boardDetailQueryOptions> & { queryKey: readonly ["boards", string] })
  const { data: todos = [] } = useQuery(todosQueryOptions(boardId) as ReturnType<typeof todosQueryOptions> & { queryKey: readonly ["boards", string, "todos"] })

  // Quick-complete mutation
  const completeMutation = useMutation({
    mutationFn: (todoId: string) => quickCompleteTodo(todoId),
    onMutate: async (todoId) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.todos(boardId) })
      const previous = queryClient.getQueryData(boardKeys.todos(boardId))

      queryClient.setQueryData<TodoWithRelations[]>(boardKeys.todos(boardId), (old) => {
        if (!old) return old
        return old.map((t) =>
          t.id === todoId
            ? { ...t, status: t.status === 'DONE' ? 'TO_DO' : 'DONE' }
            : t
        )
      })

      return { previous }
    },
    onError: (_err, _todoId, context) => {
      queryClient.setQueryData(boardKeys.todos(boardId), context?.previous)
      toast.error('Failed to complete todo — changes reverted')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
    },
  })

  // Drag-and-drop mutation for status change
  const reorderMutation = useMutation({
    mutationFn: ({ todoId, newStatus, newOrder }: { todoId: string; newStatus: string; newOrder: string }) =>
      updateTodoStatusAndOrder(todoId, newStatus as 'TO_DO' | 'IN_PROGRESS' | 'DONE', newOrder),
    onMutate: async ({ todoId, newStatus, newOrder }) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.todos(boardId) })
      const previous = queryClient.getQueryData(boardKeys.todos(boardId))

      queryClient.setQueryData<TodoWithRelations[]>(boardKeys.todos(boardId), (old) => {
        if (!old) return old
        return old.map((t) =>
          t.id === todoId ? { ...t, status: newStatus as Todo['status'], order: newOrder } : t
        )
      })

      return { previous }
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(boardKeys.todos(boardId), context?.previous)
      toast.error('Reorder failed — changes reverted')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
    },
  })

  // Handle quick complete
  const handleQuickComplete = useCallback((todoId: string) => {
    completeMutation.mutate(todoId)
  }, [completeMutation])

  // Handle todo click (open side panel)
  const handleTodoClick = useCallback((todo: TodoWithRelations) => {
    setSelectedTodo(todo)
    setSidePanelOpen(true)
  }, [])

  // Handle add todo
  const handleAddTodo = useCallback(() => {
    setSelectedTodo(null)
    setSidePanelOpen(true)
  }, [])

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)

  // Apply filters to todos
  const filteredTodos = useMemo(() => {
    return (todos as TodoWithRelations[]).filter((todo) => {
      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(todo.priority)) {
        return false
      }
      // Assignee filter
      if (filters.assignee.length > 0) {
        const assigneeId = todo.assignee?.id
        if (!assigneeId || !filters.assignee.includes(assigneeId)) {
          return false
        }
      }
      // Tag filter
      if (filters.tag.length > 0) {
        const todoTagIds = todo.tags.map((t) => t.tag.id)
        if (!filters.tag.some((tagId) => todoTagIds.includes(tagId))) {
          return false
        }
      }
      // Due date filter
      if (filters.dueDate) {
        const now = new Date()
        const dueDate = todo.dueDate ? new Date(todo.dueDate) : null
        if (filters.dueDate === 'overdue') {
          if (!dueDate || dueDate >= now) return false
        } else if (filters.dueDate === 'today') {
          if (!dueDate) return false
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          if (dueDate < today || dueDate >= tomorrow) return false
        } else if (filters.dueDate === 'week') {
          if (!dueDate) return false
          const weekFromNow = new Date(now)
          weekFromNow.setDate(weekFromNow.getDate() + 7)
          if (dueDate > weekFromNow) return false
        }
      }
      return true
    })
  }, [todos, filters])

  // Group todos by status
  const todosByStatus = useMemo(() => {
    const grouped = {
      TO_DO: filteredTodos.filter((t) => t.status === 'TO_DO'),
      IN_PROGRESS: filteredTodos.filter((t) => t.status === 'IN_PROGRESS'),
      DONE: filteredTodos.filter((t) => t.status === 'DONE'),
    }
    return grouped
  }, [filteredTodos])

  /**
   * Handle drag start — track which item is being dragged
   */
  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    setActiveId(active.id as string)
  }

  /**
   * Handle drag over — move items between columns in real-time
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find the status of the active and over items
    const activeTodo = (todos as TodoWithRelations[]).find((t) => t.id === activeId)
    const overTodo = (todos as TodoWithRelations[]).find((t) => t.id === overId)

    if (!activeTodo) return

    // If over a column (not a todo), use the column's status
    const overStatus = overTodo?.status || (['TO_DO', 'IN_PROGRESS', 'DONE'].includes(overId) ? overId as Todo['status'] : null)
    if (!overStatus) return

    // If the active todo is not in the same column as the over item, move it
    if (activeTodo.status !== overStatus) {
      // Update the todo's status optimistically
      queryClient.setQueryData<TodoWithRelations[]>(boardKeys.todos(boardId), (old) => {
        if (!old) return old
        return old.map((t) =>
          t.id === activeId ? { ...t, status: overStatus } : t
        )
      })
    }
  }

  /**
   * Handle drag end — reorder todos within and across columns
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find the active and over todos
    const activeTodo = (todos as TodoWithRelations[]).find((t) => t.id === activeId)
    const overTodo = (todos as TodoWithRelations[]).find((t) => t.id === overId)

    if (!activeTodo) return

    // Determine the target status
    const targetStatus = overTodo?.status || (['TO_DO', 'IN_PROGRESS', 'DONE'].includes(overId) ? overId as Todo['status'] : activeTodo.status)
    if (!targetStatus) return

    // If dropping on the same position, do nothing
    if (activeId === overId) return

    // Reorder within the same column
    if (activeTodo.status === targetStatus && overTodo) {
      const columnTodos = filteredTodos.filter((t) => t.status === targetStatus)
      const oldIndex = columnTodos.findIndex((t) => t.id === activeId)
      const newIndex = columnTodos.findIndex((t) => t.id === overId)

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(columnTodos, oldIndex, newIndex)
        
        // Update the todos optimistically
        queryClient.setQueryData<TodoWithRelations[]>(boardKeys.todos(boardId), (old) => {
          if (!old) return old
          
          // Remove the active todo from its current position
          const withoutActive = old.filter((t) => t.id !== activeId)
          
          // Find the insertion point in the target column
          const targetTodos = withoutActive.filter((t) => t.status === targetStatus)
          const otherTodos = withoutActive.filter((t) => t.status !== targetStatus)
          
          const insertIndex = newOrder.findIndex((t) => t.id === activeId)
          const activeTodoData = old.find((t) => t.id === activeId)!
          
          // Insert at the correct position
          targetTodos.splice(insertIndex, 0, { ...activeTodoData, status: targetStatus })
          
          return [...otherTodos, ...targetTodos]
        })

        // Generate new order key for server
        const columnTodosForOrder = (todos as TodoWithRelations[]).filter((t) => t.status === targetStatus)
        const newOrderIndex = columnTodosForOrder.findIndex((t) => t.id === activeId)
        const newOrderKey = generateKeyBetween(
          newOrderIndex > 0 ? columnTodosForOrder[newOrderIndex - 1]?.order : null,
          newOrderIndex < columnTodosForOrder.length - 1 ? columnTodosForOrder[newOrderIndex + 1]?.order : null
        )

        // Persist to server
        reorderMutation.mutate({
          todoId: activeId,
          newStatus: targetStatus,
          newOrder: newOrderKey,
        })
      }
    }
  }

  // Get board members and tags for the filter bar
  const boardDetail = board as BoardDetail | undefined
  const members = boardDetail?.members?.map((m) => m.user) || []
  const tags = boardDetail?.tags || []

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{boardDetail?.name || 'Loading...'}</h1>
        <Button onClick={handleAddTodo}>Add Todo</Button>
      </div>

      {/* Filter bar */}
      <FilterBar
        members={members}
        tags={tags}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          <KanbanColumn
            id="TO_DO"
            title="To Do"
            todos={todosByStatus.TO_DO}
            activeId={activeId}
            onQuickComplete={handleQuickComplete}
            onTodoClick={handleTodoClick}
          />
          <KanbanColumn
            id="IN_PROGRESS"
            title="In Progress"
            todos={todosByStatus.IN_PROGRESS}
            activeId={activeId}
            onQuickComplete={handleQuickComplete}
            onTodoClick={handleTodoClick}
          />
          <KanbanColumn
            id="DONE"
            title="Done"
            todos={todosByStatus.DONE}
            activeId={activeId}
            collapsible
            onQuickComplete={handleQuickComplete}
            onTodoClick={handleTodoClick}
          />
        </div>

        <DragOverlay>
          {activeId ? (() => {
            const activeTodo = (todos as TodoWithRelations[]).find((t) => t.id === activeId)
            return activeTodo ? (
              <TodoCard
                todo={activeTodo}
                isActive={false}
                isOverlay
              />
            ) : null
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* Side panel for create/edit */}
      <TodoSidePanel
        open={sidePanelOpen}
        onOpenChange={setSidePanelOpen}
        boardId={boardId}
        todo={selectedTodo}
        members={members}
        tags={tags}
      />
    </div>
  )
}
