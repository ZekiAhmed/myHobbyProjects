// THE MOST COMPLEX COMPONENT IN THE APP. This is the root of the drag-and-
// drop tree (dnd-kit's <DndContext>) and owns ALL the optimistic mutation
// logic described in TDD §8. Read the comments in order — they explain the
// optimistic-update dance in detail, since it's the trickiest part of this
// codebase for a newcomer to follow.

'use client'

import { useMemo, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todosQueryOptions } from '@/lib/queries/todos'
import { listDetailQueryOptions, listKeys } from '@/lib/queries/lists'
import { updateTodoOrder, updateTodoStatusAndOrder, quickCompleteTodo } from '@/actions/todos'
import { computeNewOrder } from '@/lib/utils/fractional-indexing'
import { KanbanColumn } from './KanbanColumn'
import { TodoCard } from './TodoCard'
import { TodoSidePanel } from './TodoSidePanel'
import { FilterBar } from './FilterBar'
import type { Priority, Todo, TodoStatus } from '@/lib/generated/prisma/client'

type TodoWithRelations = Todo & {
  assignee: { id: string; name: string; image: string | null } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

const COLUMNS: { status: TodoStatus; label: string }[] = [
  { status: 'TO_DO', label: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress' },
  { status: 'DONE', label: 'Done' },
]

export function KanbanBoard({ listId }: { listId: string }) {
  const queryClient = useQueryClient()

  // Both of these are useSuspenseQuery, so they're guaranteed to have data
  // by the time this component's body runs (thanks to the server-side
  // prefetch in page.tsx). `todosQuery` is ALSO the one that polls every
  // 8 seconds for near-real-time teammate sync — see lib/queries/todos.ts.
  const { data: listDetail } = useSuspenseQuery(listDetailQueryOptions(listId))
  const { data: todos } = useSuspenseQuery(todosQueryOptions(listId))

  // Local UI state: which filters are active, which todo (if any) is
  // currently open in the side panel, and which card is actively being
  // dragged (for the DragOverlay preview).
  const [filters, setFilters] = useState<{
    priority?: Priority
    assigneeId?: string
    tagId?: string
  }>({})
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [activeDragTodo, setActiveDragTodo] = useState<TodoWithRelations | null>(null)

  // dnd-kit requires at least one "sensor" configured — PointerSensor
  // handles both mouse and touch. `activationConstraint` requires the
  // pointer to move 5px before a drag "starts," which prevents a normal
  // click (to open the side panel) from being misread as a tiny drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // PRD feature #22: client-side filtering over already-loaded data — no
  // extra network request needed since all todos for this board are
  // already sitting in the TanStack Query cache.
  const filteredTodos = useMemo(() => {
    return (todos as TodoWithRelations[]).filter((todo) => {
      if (filters.priority && todo.priority !== filters.priority) return false
      if (filters.assigneeId && todo.assigneeId !== filters.assigneeId) return false
      if (filters.tagId && !todo.tags.some((t) => t.tag.id === filters.tagId)) return false
      return true
    })
  }, [todos, filters])

  // Group the (already filtered) todos by column, each sorted by their
  // fractional-index `order` string ascending — this sort MUST happen
  // client-side too (not just rely on the API's orderBy) because
  // optimistic updates change `order` locally before the server confirms.
  const todosByColumn = useMemo(() => {
    const grouped: Record<TodoStatus, TodoWithRelations[]> = {
      TO_DO: [],
      IN_PROGRESS: [],
      DONE: [],
    }
    for (const todo of filteredTodos) {
      grouped[todo.status].push(todo)
    }
    for (const status of Object.keys(grouped) as TodoStatus[]) {
      grouped[status].sort((a, b) => (a.order < b.order ? -1 : 1))
    }
    return grouped
  }, [filteredTodos])

  // ---------------------------------------------------------------------
  // OPTIMISTIC MUTATION: reorder within the same column, OR move across
  // columns. Both share one mutation because the "shape" of what changes
  // (status + order) is the same either way — a same-column reorder just
  // happens to keep `newStatus` equal to the todo's current status.
  //
  // THE THREE-STEP DANCE (standard TanStack Query optimistic pattern):
  //   onMutate  — runs IMMEDIATELY, before the server has responded.
  //               We manually rewrite the cached todos array so the UI
  //               updates with ZERO perceived latency (TDD performance
  //               target: "0ms perceived" for drag).
  //   onError   — if the Server Action throws, we roll the cache back to
  //               the snapshot we took in onMutate, so the UI reverts to
  //               match reality.
  //   onSettled — runs whether it succeeded OR failed; we invalidate the
  //               query so the NEXT poll (or this one, immediately) pulls
  //               the true server state, catching any subtle drift.
  // ---------------------------------------------------------------------
  const moveMutation = useMutation({
    mutationFn: ({ todoId, newStatus, newOrder }: { todoId: string; newStatus: TodoStatus; newOrder: string }) =>
      updateTodoStatusAndOrder(todoId, newStatus, newOrder),

    onMutate: async ({ todoId, newStatus, newOrder }) => {
      // Cancel any in-flight refetch for this query — otherwise a refetch
      // that resolves AFTER our optimistic write could clobber it with
      // stale (pre-drag) data.
      await queryClient.cancelQueries({ queryKey: listKeys.todos(listId) })

      // Snapshot the current cache so we can restore it exactly if the
      // mutation fails.
      const previous = queryClient.getQueryData<TodoWithRelations[]>(listKeys.todos(listId))

      queryClient.setQueryData<TodoWithRelations[]>(listKeys.todos(listId), (old) =>
        (old ?? []).map((t) =>
          t.id === todoId ? { ...t, status: newStatus, order: newOrder } : t
        )
      )

      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKeys.todos(listId), context.previous)
      }
      // In a real app, surface a toast here: "Reorder failed — changes reverted."
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) })
    },
  })

  // The ✓ quick-complete button follows the EXACT same optimistic pattern,
  // just simpler (only `status` changes, not `order`).
  const completeMutation = useMutation({
    mutationFn: (todoId: string) => quickCompleteTodo(todoId),

    onMutate: async (todoId) => {
      await queryClient.cancelQueries({ queryKey: listKeys.todos(listId) })
      const previous = queryClient.getQueryData<TodoWithRelations[]>(listKeys.todos(listId))

      queryClient.setQueryData<TodoWithRelations[]>(listKeys.todos(listId), (old) =>
        (old ?? []).map((t) => (t.id === todoId ? { ...t, status: 'DONE' as TodoStatus } : t))
      )

      return { previous }
    },

    onError: (_err, _todoId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listKeys.todos(listId), context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) })
    },
  })

  function handleDragStart(event: DragStartEvent) {
    const todo = (todos as TodoWithRelations[]).find((t) => t.id === event.active.id)
    setActiveDragTodo(todo ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragTodo(null)

    const { active, over } = event
    if (!over) return // dropped outside any valid drop target — do nothing

    const todoId = active.id as string
    // `over.id` is either a column's status (dropped on an empty column
    // area) or another todo's id (dropped directly on/near a card) —
    // both cases are handled by KanbanColumn's droppable setup.
    const overData = over.data.current as { status: TodoStatus; index: number } | undefined
    if (!overData) return

    const { status: newStatus, index: dropIndex } = overData
    const columnTodos = todosByColumn[newStatus].filter((t) => t.id !== todoId)
    const newOrder = computeNewOrder(columnTodos, dropIndex)

    moveMutation.mutate({ todoId, newStatus, newOrder })
  }

  return (
    <div>
      <header>
        <h1>{listDetail.name}</h1>
      </header>

      <FilterBar
        members={listDetail.members}
        tags={listDetail.tags}
        filters={filters}
        onChange={setFilters}
      />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              label={column.label}
              todos={todosByColumn[column.status]}
              onQuickComplete={(id) => completeMutation.mutate(id)}
              onOpenTodo={(id) => setEditingTodoId(id)}
            />
          ))}
        </div>

        {/* DragOverlay renders a floating copy of the card that follows the
            cursor while dragging — without this, dnd-kit would just show
            the original card being hidden/moved, which looks janky. */}
        <DragOverlay>
          {activeDragTodo ? <TodoCard todo={activeDragTodo} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Side panel handles BOTH create and edit — "create mode" when no
          todo is selected, "edit mode" when editingTodoId is a real id.
          See TodoSidePanel.tsx for how it decides which mode to render. */}
      {editingTodoId !== null && (
        <TodoSidePanel
          listId={listId}
          todoId={editingTodoId === 'new' ? null : editingTodoId}
          members={listDetail.members}
          tags={listDetail.tags}
          onClose={() => setEditingTodoId(null)}
        />
      )}

      <button onClick={() => setEditingTodoId('new')}>Add Todo</button>
    </div>
  )
}