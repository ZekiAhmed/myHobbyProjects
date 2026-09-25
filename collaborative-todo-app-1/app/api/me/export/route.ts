/**
 * @fileoverview GET /api/me/export — Download all personal data about the acting user
 *
 * The Data export (GDPR right to access): one synchronous JSON file attachment
 * of every personal row about the signed-in user. No background job, no email
 * delivery, no CSV — the payload is built and returned in this request.
 *
 * AUTH: an authenticated session only — no board membership or ownership
 * check, because every section is scoped to the caller's own rows. The route
 * answers 401 instead of redirecting to /sign-in: a redirect is not a
 * rejection a client consuming an attachment can act on.
 *
 * REDACTION (spec req 62): password hashes, session tokens, and invite tokens
 * must never reach the payload. Each section is projected field-by-field here,
 * so a secret cannot leak even if a query widens; OAuth access/refresh/id
 * tokens are dropped alongside them (credentials are never personal data).
 *
 * SECTIONS: profile, accounts, sessions, boards (owned + memberships),
 * todos (assigned + on owned boards), comments, notifications (with read
 * state), activity (actor-scoped), invitations (to their email, matched
 * case-insensitively because an invite is typed by the inviting Owner).
 *
 * ACCEPTED GAP: Todo has no creator field, so todos the user created on boards
 * they do not own are not in the payload (PRD §4).
 *
 * @see CONTEXT.md — "Data export" vocabulary
 */

import { NextResponse } from 'next/server'
import { getOptionalSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import type { Todo } from '@/lib/generated/prisma/browser'

function projectTodo(todo: Todo) {
  return {
    id: todo.id,
    boardId: todo.boardId,
    assigneeId: todo.assigneeId,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    priority: todo.priority,
    dueDate: todo.dueDate,
    order: todo.order,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  }
}

async function fetchTodos(userId: string) {
  const [assigned, onOwnedBoards] = await Promise.all([
    prisma.todo.findMany({ where: { assigneeId: userId } }),
    prisma.todo.findMany({ where: { board: { ownerId: userId } } }),
  ])

  return { assigned: assigned.map(projectTodo), onOwnedBoards: onOwnedBoards.map(projectTodo) }
}

export async function GET() {
  const session = await getOptionalSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const email = session.user.email

  const [
    profile,
    accounts,
    sessions,
    ownedBoards,
    memberships,
    todos,
    comments,
    notifications,
    activity,
    invitations,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.session.findMany({ where: { userId } }),
    prisma.board.findMany({ where: { ownerId: userId } }),
    prisma.boardMember.findMany({ where: { userId }, include: { board: true } }),
    fetchTodos(userId),
    prisma.comment.findMany({ where: { authorId: userId }, include: { todo: true } }),
    prisma.notification.findMany({ where: { userId } }),
    prisma.activity.findMany({ where: { actorId: userId } }),
    prisma.invitation.findMany({ where: { email: { equals: email, mode: 'insensitive' } } }),
  ])

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      emailVerified: profile.emailVerified,
      image: profile.image,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
    accounts: accounts.map((account) => ({
      id: account.id,
      accountId: account.accountId,
      providerId: account.providerId,
      scope: account.scope,
      accessTokenExpiresAt: account.accessTokenExpiresAt,
      refreshTokenExpiresAt: account.refreshTokenExpiresAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
    sessions: sessions.map((activeSession) => ({
      id: activeSession.id,
      ipAddress: activeSession.ipAddress,
      userAgent: activeSession.userAgent,
      createdAt: activeSession.createdAt,
      updatedAt: activeSession.updatedAt,
      expiresAt: activeSession.expiresAt,
    })),
    boards: {
      owned: ownedBoards.map((board) => ({
        id: board.id,
        name: board.name,
        ownerId: board.ownerId,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      })),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        boardId: membership.boardId,
        boardName: membership.board.name,
        userId: membership.userId,
        joinedAt: membership.joinedAt,
      })),
    },
    todos,
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      todoId: comment.todoId,
      todoTitle: comment.todo.title,
      boardId: comment.todo.boardId,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })),
    notifications: notifications.map((notification) => ({
      id: notification.id,
      type: notification.type,
      boardId: notification.boardId,
      todoId: notification.todoId,
      actorId: notification.actorId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      boardId: entry.boardId,
      actorId: entry.actorId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      ipAddress: entry.ipAddress,
      createdAt: entry.createdAt,
    })),
    invitations: invitations.map((invitation) => ({
      id: invitation.id,
      boardId: invitation.boardId,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })),
  }

  const date = new Date().toISOString().slice(0, 10)

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="data-export-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
