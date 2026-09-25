'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { generateKeyBetween } from 'fractional-indexing'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'
import { activityData, getBestEffortIp } from '@/lib/activity'
import { assignmentNotificationData, isAssignedToSomeoneElse } from '@/lib/notifications'

const CreateTodoSchema = z.object({
  boardId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['TO_DO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
})

const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['TO_DO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
})

const todoInclude = {
  assignee: { select: { id: true, name: true, image: true } },
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
} as const

async function verifyBoardMembership(boardId: string, userId: string) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  })

  if (!board) return actionError('server', 'Board not found')

  const isOwner = board.ownerId === userId
  if (!isOwner) {
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId },
    })
    if (!membership) return actionError('authorization', 'You are not a member of this board')
  }

  return { isOwner, error: null }
}

type TodoWithRelations = {
  id: string
  title: string
  description: string | null
  status: 'TO_DO' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate: Date | null
  order: string
  boardId: string
  assigneeId: string | null
  createdAt: Date
  updatedAt: Date
  assignee: { id: string; name: string; image: string | null } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

async function getOrderForPosition(boardId: string, status: string, position?: number) {
  const columnTodos = await prisma.todo.findMany({
    where: { boardId, status: status as 'TO_DO' | 'IN_PROGRESS' | 'DONE' },
    select: { order: true },
    orderBy: { order: 'asc' },
  })

  if (columnTodos.length === 0) {
    return generateKeyBetween(null, null)
  }

  const pos = position ?? columnTodos.length

  if (pos === 0) {
    return generateKeyBetween(null, columnTodos[0].order)
  }

  if (pos >= columnTodos.length) {
    return generateKeyBetween(columnTodos[columnTodos.length - 1].order, null)
  }

  return generateKeyBetween(columnTodos[pos - 1].order, columnTodos[pos].order)
}

export async function createTodo(input: {
  boardId: string
  title: string
  description?: string
  status?: 'TO_DO' | 'IN_PROGRESS' | 'DONE'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  assigneeId?: string
  tagIds?: string[]
}): Promise<ActionResult<TodoWithRelations>> {
  try {
    const session = await getRequiredSession()
    const parsed = CreateTodoSchema.safeParse(input)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid todo data')
    }

    const membershipResult = await verifyBoardMembership(parsed.data.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const status = parsed.data.status ?? 'TO_DO'
    const order = await getOrderForPosition(parsed.data.boardId, status)
    const ipAddress = await getBestEffortIp()
    // A Todo created already assigned is an assignment: the assignee is told,
    // except when the creator assigns themself (spec — targeted only).
    const assignedToSomeoneElse = isAssignedToSomeoneElse(
      parsed.data.assigneeId,
      session.user.id
    )

    const todo = await prisma.$transaction(async (tx) => {
      const created = await tx.todo.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          status,
          priority: parsed.data.priority ?? 'MEDIUM',
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          order,
          boardId: parsed.data.boardId,
          assigneeId: parsed.data.assigneeId,
          tags: parsed.data.tagIds?.length
            ? { create: parsed.data.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
        include: todoInclude,
      })

      await tx.activity.create({
        data: activityData({
          boardId: parsed.data.boardId,
          actorId: session.user.id,
          action: 'todo.created',
          resourceType: 'TODO',
          resourceId: created.id,
          ipAddress,
        }),
      })

      if (assignedToSomeoneElse) {
        await tx.notification.create({
          data: assignmentNotificationData({
            assigneeId: parsed.data.assigneeId,
            actorId: session.user.id,
            boardId: parsed.data.boardId,
            todoId: created.id,
          }),
        })
      }

      return created
    })

    revalidateTag('todos', 'max')
    revalidateTag('activity', 'max')
    if (assignedToSomeoneElse) revalidateTag('notifications', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to create todo')
  }
}

export async function updateTodo(
  todoId: string,
  input: {
    title?: string
    description?: string
    status?: 'TO_DO' | 'IN_PROGRESS' | 'DONE'
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    dueDate?: string | null
    assigneeId?: string | null
    tagIds?: string[]
  }
): Promise<ActionResult<TodoWithRelations>> {
  try {
    const session = await getRequiredSession()
    const parsed = UpdateTodoSchema.safeParse(input)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      return actionError('validation', firstError?.message || 'Invalid todo data')
    }

    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      select: { boardId: true, status: true, assigneeId: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const updateData: Record<string, unknown> = {}

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority
    if (parsed.data.dueDate !== undefined) updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null
    if (parsed.data.assigneeId !== undefined) updateData.assigneeId = parsed.data.assigneeId

    // ADR-0002: only the two collaboration-relevant changes emit Activity.
    // Title/description/priority/due-date edits and tag retags are field-level
    // noise and must stay out of the feed.
    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existingTodo.status
    const assigneeChanged =
      parsed.data.assigneeId !== undefined &&
      parsed.data.assigneeId !== existingTodo.assigneeId
    // Targeted-only emission: the new assignee is notified, except on
    // self-assignment. Bystanders (owner, other members) never get a row.
    const assignedToSomeoneElse =
      assigneeChanged &&
      isAssignedToSomeoneElse(parsed.data.assigneeId, session.user.id)
    const ipAddress =
      statusChanged || assigneeChanged ? await getBestEffortIp() : null

    if (parsed.data.tagIds !== undefined) {
      await prisma.todoTag.deleteMany({ where: { todoId } })
      if (parsed.data.tagIds.length > 0) {
        await prisma.todoTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({ todoId, tagId })),
        })
      }
    }

    const todo = await prisma.$transaction(async (tx) => {
      const updated = await tx.todo.update({
        where: { id: todoId },
        data: updateData,
        include: todoInclude,
      })

      if (statusChanged) {
        await tx.activity.create({
          data: activityData({
            boardId: existingTodo.boardId,
            actorId: session.user.id,
            action: 'todo.status_changed',
            resourceType: 'TODO',
            resourceId: todoId,
            ipAddress,
          }),
        })
      }

      if (assigneeChanged) {
        await tx.activity.create({
          data: activityData({
            boardId: existingTodo.boardId,
            actorId: session.user.id,
            action: 'todo.assignee_changed',
            resourceType: 'TODO',
            resourceId: todoId,
            ipAddress,
          }),
        })
      }

      if (assignedToSomeoneElse) {
        await tx.notification.create({
          data: assignmentNotificationData({
            assigneeId: parsed.data.assigneeId,
            actorId: session.user.id,
            boardId: existingTodo.boardId,
            todoId,
          }),
        })
      }

      return updated
    })

    revalidateTag('todos', 'max')
    if (statusChanged || assigneeChanged) {
      revalidateTag('activity', 'max')
    }
    if (assignedToSomeoneElse) revalidateTag('notifications', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to update todo')
  }
}

export async function deleteTodo(todoId: string): Promise<ActionResult<{ success: true }>> {
  try {
    const session = await getRequiredSession()

    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      select: { boardId: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const ipAddress = await getBestEffortIp()

    await prisma.$transaction(async (tx) => {
      await tx.todo.delete({ where: { id: todoId } })

      await tx.activity.create({
        data: activityData({
          boardId: existingTodo.boardId,
          actorId: session.user.id,
          action: 'todo.deleted',
          // The Todo row is gone by design — its id IS the compliance record.
          // BOARD/boardId would only repeat the entry's own boardId.
          resourceType: 'TODO',
          resourceId: todoId,
          ipAddress,
        }),
      })
    })

    revalidateTag('todos', 'max')
    revalidateTag('activity', 'max')

    return actionSuccess({ success: true as const })
  } catch {
    return actionError('server', 'Failed to delete todo')
  }
}

export async function quickCompleteTodo(todoId: string): Promise<ActionResult<TodoWithRelations>> {
  try {
    const session = await getRequiredSession()

    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      select: { boardId: true, status: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const newStatus = existingTodo.status === 'DONE' ? 'TO_DO' : 'DONE'

    const order = await getOrderForPosition(existingTodo.boardId, newStatus)
    const ipAddress = await getBestEffortIp()

    const todo = await prisma.$transaction(async (tx) => {
      const updated = await tx.todo.update({
        where: { id: todoId },
        data: { status: newStatus, order },
        include: todoInclude,
      })

      await tx.activity.create({
        data: activityData({
          boardId: existingTodo.boardId,
          actorId: session.user.id,
          action: 'todo.status_changed',
          resourceType: 'TODO',
          resourceId: todoId,
          ipAddress,
        }),
      })

      return updated
    })

    revalidateTag('todos', 'max')
    revalidateTag('activity', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to complete todo')
  }
}

/**
 * Drag reorder only — status untouched.
 *
 * Emits NO Activity row: reorders are field-level noise and never appear in
 * the feed (ADR-0002).
 */
export async function updateTodoOrder(todoId: string, newOrder: string): Promise<ActionResult<TodoWithRelations>> {
  try {
    const session = await getRequiredSession()

    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      select: { boardId: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const todo = await prisma.todo.update({
      where: { id: todoId },
      data: { order: newOrder },
      include: todoInclude,
    })

    revalidateTag('todos', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to update todo order')
  }
}

export async function updateTodoStatusAndOrder(
  todoId: string,
  newStatus: 'TO_DO' | 'IN_PROGRESS' | 'DONE',
  newOrder: string
): Promise<ActionResult<TodoWithRelations>> {
  try {
    const session = await getRequiredSession()

    const existingTodo = await prisma.todo.findUnique({
      where: { id: todoId },
      select: { boardId: true, status: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    // Dragging a todo inside its current column changes `order` only — that is
    // a reorder, which never emits Activity (ADR-0002). A real column change
    // does, atomically with the write.
    const statusChanged = existingTodo.status !== newStatus
    const ipAddress = statusChanged ? await getBestEffortIp() : null

    const todo = await prisma.$transaction(async (tx) => {
      const updated = await tx.todo.update({
        where: { id: todoId },
        data: { status: newStatus, order: newOrder },
        include: todoInclude,
      })

      if (statusChanged) {
        await tx.activity.create({
          data: activityData({
            boardId: existingTodo.boardId,
            actorId: session.user.id,
            action: 'todo.status_changed',
            resourceType: 'TODO',
            resourceId: todoId,
            ipAddress,
          }),
        })
      }

      return updated
    })

    revalidateTag('todos', 'max')
    if (statusChanged) {
      revalidateTag('activity', 'max')
    }

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to update todo')
  }
}
