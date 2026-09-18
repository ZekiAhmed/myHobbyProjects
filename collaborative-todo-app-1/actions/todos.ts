'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { generateKeyBetween } from 'fractional-indexing'
import { z } from 'zod/v4'
import { actionSuccess, actionError, type ActionResult } from '@/lib/errors'

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

    const todo = await prisma.todo.create({
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

    revalidateTag('todos', 'max')

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
      select: { boardId: true },
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

    if (parsed.data.tagIds !== undefined) {
      await prisma.todoTag.deleteMany({ where: { todoId } })
      if (parsed.data.tagIds.length > 0) {
        await prisma.todoTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({ todoId, tagId })),
        })
      }
    }

    const todo = await prisma.todo.update({
      where: { id: todoId },
      data: updateData,
      include: todoInclude,
    })

    revalidateTag('todos', 'max')

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

    await prisma.todo.delete({ where: { id: todoId } })

    revalidateTag('todos', 'max')

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

    const todo = await prisma.todo.update({
      where: { id: todoId },
      data: { status: newStatus, order },
      include: todoInclude,
    })

    revalidateTag('todos', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to complete todo')
  }
}

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
      select: { boardId: true },
    })

    if (!existingTodo) return actionError('server', 'Todo not found')

    const membershipResult = await verifyBoardMembership(existingTodo.boardId, session.user.id)
    if (membershipResult.error) return membershipResult

    const todo = await prisma.$transaction(async (tx) => {
      return tx.todo.update({
        where: { id: todoId },
        data: { status: newStatus, order: newOrder },
        include: todoInclude,
      })
    })

    revalidateTag('todos', 'max')

    return actionSuccess(todo as TodoWithRelations)
  } catch {
    return actionError('server', 'Failed to update todo')
  }
}
