/**
 * @fileoverview Shared Type Definitions
 *
 * This file contains shared TypeScript types used across the application.
 * Centralizing types prevents duplication and ensures consistency.
 */

import type { Todo, BoardMember, Tag } from '@/lib/generated/prisma/browser'

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
