/**
 * @fileoverview Shared Type Definitions
 *
 * This file contains shared TypeScript types used across the application.
 * Centralizing types prevents duplication and ensures consistency.
 */

import type { Todo, BoardMember, Tag, Comment } from '@/lib/generated/prisma/browser'

/**
 * Board type definition — matches the shape returned by Prisma
 *
 * This type represents a board with its metadata:
 * - id: Unique identifier (CUID)
 * - name: Display name (e.g., "Sprint 42")
 * - ownerId: ID of the user who owns the board
 * - createdAt/updatedAt: Timestamps
 * - _count: Metadata counts (members and open todos)
 */
export type Board = {
  id: string
  name: string
  ownerId: string
  createdAt: Date
  updatedAt: Date
  _count: {
    members: number  // Total number of members (excluding owner)
    todos: number    // Number of open (non-DONE) todos
  }
}

/**
 * Todo with related data — used by KanbanBoard, KanbanColumn, TodoCard, TodoSidePanel
 *
 * This type represents a todo item with its assignee and tags included.
 * Centralizing this prevents duplication across components.
 */
export type TodoWithRelations = Todo & {
  assignee: { id: string; name: string; image: string | null } | null
  tags: { tag: { id: string; name: string; color: string } }[]
}

/**
 * Board detail with members and tags — used by KanbanBoard and TodoSidePanel
 */
export type BoardDetail = {
  id: string
  name: string
  ownerId: string
  owner: { id: string; name: string; email: string; image: string | null }
  members: (BoardMember & {
    user: { id: string; name: string; email: string; image: string | null }
  })[]
  tags: Tag[]
}

/**
 * Comment with its author — used by the Comment feed in TodoSidePanel
 */
export type CommentWithAuthor = Comment & {
  author: { id: string; name: string; image: string | null }
}

/**
 * One page of a Todo's Comment feed (GET /api/todos/[id]/comments).
 *
 * Comments inside a page are ordered oldest → newest.
 * `nextCursor` is the id of the oldest returned comment when older pages
 * exist (drives the "Load older" control), otherwise null.
 */
export type CommentFeedPage = {
  comments: CommentWithAuthor[]
  nextCursor: string | null
}

/**
 * One Activity entry with its actor resolved — used by the board Activity feed.
 *
 * `actor` is null once the account that performed the entry is erased
 * (`Activity.actorId` is `SetNull`); the feed renders that as "Former member".
 * A member who was merely removed from the board keeps their name.
 *
 * `ipAddress` is a compliance column (ADR-0002) and is deliberately not
 * returned to board members.
 */
export type ActivityWithActor = {
  id: string
  action: string
  resourceType: string
  resourceId: string
  createdAt: Date | string
  actor: { id: string; name: string; image: string | null } | null
}

/**
 * One page of a board's Activity feed (GET /api/boards/[id]/activity).
 *
 * Entries inside a page are ordered newest → oldest (the feed's display
 * order). `nextCursor` is the id of the oldest returned entry when older
 * pages exist (drives the "Load older" control), otherwise null.
 */
export type ActivityFeedPage = {
  activities: ActivityWithActor[]
  nextCursor: string | null
}

/**
 * One Notification for the dropdown — the recipient's row with its actor and
 * Todo resolved.
 *
 * `actor` is null once the account that caused it is erased (`Notification.
 * actorId` is `SetNull`). Only the addressed user ever reads their rows:
 * the bell is self-scoped, with no board-level view.
 */
export type NotificationWithRefs = {
  id: string
  type: 'ASSIGNED' | 'COMMENTED'
  readAt: Date | string | null
  createdAt: Date | string
  boardId: string
  actor: { id: string; name: string; image: string | null } | null
  todo: { id: string; title: string }
}

/**
 * One page of the acting user's Notification dropdown
 * (GET /api/notifications).
 *
 * Rows are newest → oldest (the dropdown's display order). `nextCursor` is
 * the id of the oldest returned row when older pages exist, otherwise null.
 * `unreadCount` is the bell badge value — the count of this user's rows with
 * `readAt` null — so one poll refreshes badge and list together.
 */
export type NotificationFeedPage = {
  notifications: NotificationWithRefs[]
  nextCursor: string | null
  unreadCount: number
}
