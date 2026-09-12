// A single draggable card. Uses dnd-kit's useSortable hook, which gives us
// everything needed to make this element draggable AND to smoothly animate
// other cards out of the way while dragging.

'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Todo, TodoStatus } from '@/lib/generated/prisma/client'

type TodoCardProps = {
  todo: Todo & {
    assignee: { id: string; name: string; image: string | null } | null
    tags: { tag: { id: string; name: string; color: string } }[]
  }
  index?: number
  status?: TodoStatus
  isOverlay?: boolean // true only for the floating copy shown in DragOverlay
  onQuickComplete?: () => void
  onOpen?: () => void
}

export function TodoCard({ todo, index, status, isOverlay, onQuickComplete, onOpen }: TodoCardProps) {
  // useSortable needs a unique `id` (the todo's id) plus a `data` payload
  // describing WHERE this card currently sits — KanbanBoard's handleDragEnd
  // reads this `data` off whatever element the user drops onto.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
    data: { status, index },
    disabled: isOverlay, // the overlay copy is just a visual, not interactive
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1, // "ghost" the original spot while dragging
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners} // spreading listeners here makes the WHOLE card draggable
      onClick={onOpen}
    >
      <div>
        <span>{todo.priority}</span>
        {todo.dueDate && <span>{new Date(todo.dueDate).toLocaleDateString()}</span>}
      </div>

      <h4>{todo.title}</h4>

      <div>
        {todo.tags.map(({ tag }) => (
          <span key={tag.id} style={{ backgroundColor: tag.color }}>
            {tag.name}
          </span>
        ))}
      </div>

      <div>
        {todo.assignee && <span>{todo.assignee.name}</span>}

        {/* stopPropagation is important here — without it, clicking the ✓
            button would ALSO trigger the card's onClick={onOpen} above,
            opening the side panel right after completing the todo. */}
        {status !== 'DONE' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onQuickComplete?.()
            }}
            aria-label="Mark complete"
          >
            ✓
          </button>
        )}
      </div>
    </div>
  )
}