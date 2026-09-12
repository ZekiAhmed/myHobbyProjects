// Handles BOTH creating a new todo and editing an existing one, in one
// component — the only difference is whether `todoId` is null (create) or
// a real id (edit). This mirrors the TDD's note that create/edit/delete
// are "pure CRUD" WITHOUT optimistic UI — the panel's own open/loading
// state IS the feedback the user needs while the Server Action runs.

// 'use client'

// import { useState } from 'react'
// import { useQueryClient } from '@tanstack/react-query'
// import { createTodo, updateTodo, deleteTodo } from '@/actions/todos'
// import { listKeys } from '@/lib/queries/lists'
// import { Button } from '@/components/ui/button'
// import { Select} from '@/components/ui/select'
// import { Input} from '@/components/ui/input'
// import { Modal} from '@/components/ui'
// import type { Priority } from '@/lib/generated/prisma/client'

// type Member = { id: string; name: string }
// type TagOption = { id: string; name: string; color: string }

// type TodoSidePanelProps = {
//   listId: string
//   todoId: string | null // null = create mode, string = edit mode
//   members: Member[]
//   tags: TagOption[]
//   onClose: () => void
// }

// const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

// export function TodoSidePanel({ listId, todoId, members, tags, onClose }: TodoSidePanelProps) {
//   const queryClient = useQueryClient()
//   const isEditMode = todoId !== null

//   const [title, setTitle] = useState('')
//   const [description, setDescription] = useState('')
//   const [priority, setPriority] = useState<Priority>('MEDIUM')
//   const [dueDate, setDueDate] = useState('')
//   const [assigneeId, setAssigneeId] = useState<string>('')
//   const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   // NOTE: in a real build, edit mode would fetch/pre-populate these fields
//   // from the todo already sitting in the TanStack Query cache (no extra
//   // network request needed, since KanbanBoard already has the full list of
//   // todos loaded) — omitted here for brevity, but the pattern is:
//   //   const todos = queryClient.getQueryData<Todo[]>(listKeys.todos(listId))
//   //   const todo = todos?.find(t => t.id === todoId)
//   //   then useState(todo?.title ?? '') etc. via useEffect on mount.

//   async function handleSave() {
//     setIsSubmitting(true)
//     setError(null)

//     try {
//       const payload = {
//         title,
//         description,
//         priority,
//         dueDate: dueDate ? new Date(dueDate) : null,
//         assigneeId: assigneeId || null,
//         tagIds: selectedTagIds,
//       }

//       if (isEditMode) {
//         await updateTodo(todoId, payload)
//       } else {
//         await createTodo(listId, payload)
//       }

//       // Invalidate the client-side todos cache so the board re-fetches and
//       // shows the new/updated card immediately, instead of waiting up to
//       // 8 seconds for the next scheduled poll.
//       await queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) })
//       onClose()
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to save todo')
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   async function handleDelete() {
//     if (!isEditMode) return
//     setIsSubmitting(true)

//     try {
//       await deleteTodo(todoId)
//       await queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) })
//       onClose()
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to delete todo')
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <Modal onClose={onClose} title={isEditMode ? 'Edit Todo' : 'New Todo'}>
//       {error && <p role="alert">{error}</p>}

//       <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
//       <Input
//         label="Description"
//         value={description}
//         onChange={(e) => setDescription(e.target.value)}
//       />

//       <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
//         {PRIORITIES.map((p) => (
//           <option key={p} value={p}>{p}</option>
//         ))}
//       </Select>

//       <Input
//         label="Due date"
//         type="date"
//         value={dueDate}
//         onChange={(e) => setDueDate(e.target.value)}
//       />

//       <Select label="Assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
//         <option value="">Unassigned</option>
//         {members.map((m) => (
//           <option key={m.id} value={m.id}>{m.name}</option>
//         ))}
//       </Select>

//       <fieldset>
//         <legend>Tags</legend>
//         {tags.map((tag) => (
//           <label key={tag.id}>
//             <input
//               type="checkbox"
//               checked={selectedTagIds.includes(tag.id)}
//               onChange={(e) =>
//                 setSelectedTagIds((prev) =>
//                   e.target.checked ? [...prev, tag.id] : prev.filter((id) => id !== tag.id)
//                 )
//               }
//             />
//             {tag.name}
//           </label>
//         ))}
//       </fieldset>

//       <div>
//         <Button onClick={handleSave} disabled={isSubmitting || !title.trim()}>
//           {isSubmitting ? 'Saving…' : 'Save'}
//         </Button>

//         {isEditMode && (
//           // Destructive action placed at the bottom, visually separated —
//           // per PRD's side-panel edit-mode spec.
//           <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
//             Delete Todo
//           </Button>
//         )}
//       </div>
//     </Modal>
//   )
// }

//=================================================================================

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createTodo, updateTodo, deleteTodo } from "@/actions/todos";
import { listKeys } from "@/lib/queries/lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Priority } from "@/lib/generated/prisma/client";

type Member = { id: string; name: string };
type TagOption = { id: string; name: string; color: string };

type TodoSidePanelProps = {
  listId: string;
  todoId: string | null; // null = create mode, string = edit mode
  members: Member[];
  tags: TagOption[];
  onClose: () => void;
};

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TodoSidePanel({
  listId,
  todoId,
  members,
  tags,
  onClose,
}: TodoSidePanelProps) {
  const queryClient = useQueryClient();
  const isEditMode = todoId !== null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        assigneeId: assigneeId === "unassigned" ? null : assigneeId,
        tagIds: selectedTagIds,
      };

      if (isEditMode) {
        await updateTodo(todoId, payload);
      } else {
        await createTodo(listId, payload);
      }

      await queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save todo");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEditMode) return;
    setIsSubmitting(true);

    try {
      await deleteTodo(todoId);
      await queryClient.invalidateQueries({ queryKey: listKeys.todos(listId) });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete todo");
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Todo" : "New Todo"}</SheetTitle>
        </SheetHeader>

        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="todo-title">Title</Label>
            <Input
              id="todo-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task summary..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="todo-desc">Description</Label>
            <Textarea
              id="todo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
            />
          </div>

          {/* Priority */}
          <div className="grid gap-2">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(val) => setPriority(val as Priority)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="grid gap-2">
            <Label htmlFor="todo-duedate">Due date</Label>
            <Input
              id="todo-duedate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Assignee */}
          <div className="grid gap-2">
            <Label>Assignee</Label>
            <Select
              value={assigneeId}
              onValueChange={(val) => setAssigneeId(val ?? "unassigned")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Assign team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`tag-${tag.id}`}
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={(checked) =>
                      setSelectedTagIds((prev) =>
                        checked
                          ? [...prev, tag.id]
                          : prev.filter((id) => id !== tag.id),
                      )
                    }
                  />
                  <label
                    htmlFor={`tag-${tag.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {tag.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col sm:justify-start">
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !title.trim()}
            className="w-full"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </Button>

          {isEditMode && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="w-full"
            >
              Delete Todo
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
