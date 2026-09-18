'use server'

import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { generateKeyBetween } from 'fractional-indexing'
import { z } from 'zod/v4'

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

  if (!board) throw new Error('Board not found')

  const isOwner = board.ownerId === userId
  if (!isOwner) {
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId },
    })
    if (!membership) throw new Error('Forbidden')
  }

  return { isOwner }
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
}) {
  const session = await getRequiredSession()
  const parsed = CreateTodoSchema.parse(input)

  await verifyBoardMembership(parsed.boardId, session.user.id)

  const status = parsed.status ?? 'TO_DO'
  const order = await getOrderForPosition(parsed.boardId, status)

  const todo = await prisma.todo.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      status,
      priority: parsed.priority ?? 'MEDIUM',
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      order,
      boardId: parsed.boardId,
      assigneeId: parsed.assigneeId,
      tags: parsed.tagIds?.length
        ? { create: parsed.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
    include: todoInclude,
  })

  revalidateTag('todos', 'max')

  return todo
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
) {
  const session = await getRequiredSession()
  const parsed = UpdateTodoSchema.parse(input)

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { boardId: true },
  })

  if (!existingTodo) throw new Error('Todo not found')

  await verifyBoardMembership(existingTodo.boardId, session.user.id)

  const updateData: Record<string, unknown> = {}

  if (parsed.title !== undefined) updateData.title = parsed.title
  if (parsed.description !== undefined) updateData.description = parsed.description
  if (parsed.status !== undefined) updateData.status = parsed.status
  if (parsed.priority !== undefined) updateData.priority = parsed.priority
  if (parsed.dueDate !== undefined) updateData.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null
  if (parsed.assigneeId !== undefined) updateData.assigneeId = parsed.assigneeId

  if (parsed.tagIds !== undefined) {
    await prisma.todoTag.deleteMany({ where: { todoId } })
    if (parsed.tagIds.length > 0) {
      await prisma.todoTag.createMany({
        data: parsed.tagIds.map((tagId) => ({ todoId, tagId })),
      })
    }
  }

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data: updateData,
    include: todoInclude,
  })

  revalidateTag('todos', 'max')

  return todo
}

export async function deleteTodo(todoId: string) {
  const session = await getRequiredSession()

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { boardId: true },
  })

  if (!existingTodo) throw new Error('Todo not found')

  await verifyBoardMembership(existingTodo.boardId, session.user.id)

  await prisma.todo.delete({ where: { id: todoId } })

  revalidateTag('todos', 'max')

  return { success: true }
}

export async function quickCompleteTodo(todoId: string) {
  const session = await getRequiredSession()

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { boardId: true, status: true },
  })

  if (!existingTodo) throw new Error('Todo not found')

  await verifyBoardMembership(existingTodo.boardId, session.user.id)

  const newStatus = existingTodo.status === 'DONE' ? 'TO_DO' : 'DONE'

  const order = await getOrderForPosition(existingTodo.boardId, newStatus)

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data: { status: newStatus, order },
    include: todoInclude,
  })

  revalidateTag('todos', 'max')

  return todo
}

export async function updateTodoOrder(todoId: string, newOrder: string) {
  const session = await getRequiredSession()

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { boardId: true },
  })

  if (!existingTodo) throw new Error('Todo not found')

  await verifyBoardMembership(existingTodo.boardId, session.user.id)

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data: { order: newOrder },
    include: todoInclude,
  })

  revalidateTag('todos', 'max')

  return todo
}

export async function updateTodoStatusAndOrder(
  todoId: string,
  newStatus: 'TO_DO' | 'IN_PROGRESS' | 'DONE',
  newOrder: string
) {
  const session = await getRequiredSession()

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { boardId: true },
  })

  if (!existingTodo) throw new Error('Todo not found')

  await verifyBoardMembership(existingTodo.boardId, session.user.id)

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data: { status: newStatus, order: newOrder },
    include: todoInclude,
  })

  revalidateTag('todos', 'max')

  return todo
}
