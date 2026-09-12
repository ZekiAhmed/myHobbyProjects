// Server Actions covering the full Todo lifecycle. Two of these
// (updateTodoOrder, updateTodoStatusAndOrder) are called from OPTIMISTIC
// mutations on the client (see components/board/KanbanBoard.tsx) — meaning
// the UI has already updated itself before this function even runs. Their
// job is just to make the database agree with what the UI already shows,
// and to fail loudly enough that the client can roll back if something
// goes wrong.

"use server";

import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/session";
import { updateTag } from "next/cache";
import type { Priority, TodoStatus } from "../lib/generated/prisma/client";

// Shared helper: throws unless the current user is a member OR the owner
// of the given list. Used by every action in this file since any member
// can create/edit/delete todos (per PRD's owner-vs-member table).
async function assertListAccess(listId: string, userId: string) {
  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });

  if (list.ownerId === userId) return; // owners always have access

  const membership = await prisma.listMember.findFirst({
    where: { listId, userId },
  });

  if (!membership) {
    throw new Error("Forbidden: you are not a member of this list");
  }
}

type CreateTodoInput = {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: Date | null;
  assigneeId?: string | null;
  tagIds?: string[];
};

/** Creates a new Todo in the TO_DO column, at the end of that column. */
export async function createTodo(listId: string, data: CreateTodoInput) {
  const session = await getRequiredSession();
  await assertListAccess(listId, session.user.id);

  if (!data.title.trim()) {
    throw new Error("Todo title is required");
  }

  // Find the current last card in the TO_DO column so the new card's order
  // key sorts AFTER it. Passing `null` as the "next" bound to
  // computeNewOrder tells fractional-indexing "there's nothing after this,
  // just give me a key bigger than the last one."
  const lastTodo = await prisma.todo.findFirst({
    where: { listId, status: "TO_DO" },
    orderBy: { order: "desc" },
  });

  const { computeNewOrder } = await import("@/lib/utils/fractional-indexing");
  const newOrder = computeNewOrder(
    lastTodo ? [lastTodo] : [],
    lastTodo ? 1 : 0,
  );

  const todo = await prisma.todo.create({
    data: {
      title: data.title.trim(),
      description: data.description,
      priority: data.priority ?? "MEDIUM",
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
      listId,
      order: newOrder,
      status: "TO_DO",
      // Connect any tags the user selected in the create form.
      tags: data.tagIds
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  updateTag("todos");
  return { success: true, todo };
}

type UpdateTodoInput = Partial<CreateTodoInput> & { status?: TodoStatus };

/** Edits an existing Todo's fields (used by the side panel's edit mode). */
export async function updateTodo(todoId: string, data: UpdateTodoInput) {
  const session = await getRequiredSession();

  const existing = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
  });
  await assertListAccess(existing.listId, session.user.id);

  await prisma.todo.update({
    where: { id: todoId },
    data: {
      title: data.title?.trim(),
      description: data.description,
      priority: data.priority,
      status: data.status,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
      // Tags are a many-to-many relation, so "updating" them means
      // replacing the whole set: delete all existing TodoTag rows for
      // this todo, then recreate them from the new tagIds list.
      tags: data.tagIds
        ? {
            deleteMany: {},
            create: data.tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
  });

  updateTag("todos");
  return { success: true };
}

/** Permanently deletes a Todo. Any member (or the owner) can delete any todo. */
export async function deleteTodo(todoId: string) {
  const session = await getRequiredSession();

  const existing = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
  });
  await assertListAccess(existing.listId, session.user.id);

  await prisma.todo.delete({ where: { id: todoId } });

  updateTag("todos");
  return { success: true };
}

/**
 * The ✓ quick-complete button. Just flips status to DONE — it does NOT
 * touch `order`, so the card keeps its relative position if the DONE
 * column is later expanded/sorted the same way.
 */
export async function quickCompleteTodo(todoId: string) {
  const session = await getRequiredSession();

  const existing = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
  });
  await assertListAccess(existing.listId, session.user.id);

  await prisma.todo.update({
    where: { id: todoId },
    data: { status: "DONE" },
  });

  updateTag("todos");
  return { success: true };
}

/**
 * Called after a drag-and-drop reorder WITHIN THE SAME column. The client
 * has already computed `newOrder` using computeNewOrder() based on where
 * the card was dropped (see components/board/KanbanBoard.tsx) — this
 * action's only job is to persist that value.
 */
export async function updateTodoOrder(todoId: string, newOrder: string) {
  const session = await getRequiredSession();

  const existing = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
  });
  await assertListAccess(existing.listId, session.user.id);

  await prisma.todo.update({
    where: { id: todoId },
    data: { order: newOrder },
  });

  updateTag("todos");
  return { success: true };
}

/**
 * Called after a drag-and-drop move ACROSS columns (e.g. To Do -> In
 * Progress). Both `status` and `order` change together, so we wrap them in
 * a `$transaction` — this guarantees that if anything fails partway
 * through, the todo never ends up in a half-updated, inconsistent state
 * (e.g. new status but old order, which could look broken on a teammate's
 * screen that polls in between the two writes).
 */
export async function updateTodoStatusAndOrder(
  todoId: string,
  newStatus: TodoStatus,
  newOrder: string,
) {
  const session = await getRequiredSession();

  const existing = await prisma.todo.findUniqueOrThrow({
    where: { id: todoId },
  });
  await assertListAccess(existing.listId, session.user.id);

  await prisma.$transaction([
    prisma.todo.update({
      where: { id: todoId },
      data: { status: newStatus, order: newOrder },
    }),
  ]);

  updateTag("todos");
  return { success: true };
}
