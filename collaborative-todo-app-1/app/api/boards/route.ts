/**
 * @fileoverview GET /api/boards — Fetch all boards for the current user
 *
 * This Route Handler returns all boards where the current user is either:
 *   - The owner (ownerId matches), OR
 *   - A member (exists in the BoardMember table)
 *
 * WHY A ROUTE HANDLER INSTEAD OF A SERVER ACTION?
 * - Server Actions are for mutations (create, update, delete)
 * - Route Handlers are for reads (GET requests)
 * - TanStack Query's queryFn expects a fetch() call, which works naturally with Route Handlers
 * - This endpoint is polled every 8 seconds by the client for near-real-time sync
 *
 * DATA STRUCTURE RETURNED:
 * Each board includes:
 *   - id, name, ownerId, createdAt, updatedAt (basic fields)
 *   - _count.members: total number of members (excluding owner)
 *   - _count.todos: number of open (non-DONE) todos
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/route-handlers
 */

import { NextResponse } from 'next/server'
import { getRequiredSession } from '@/lib/session'
import { fetchBoards } from '@/lib/queries/boards'

/**
 * GET /api/boards
 *
 * Returns all boards the current user has access to.
 *
 * AUTHENTICATION:
 * getRequiredSession() checks for a valid session cookie.
 * If no session exists, it redirects to /sign-in.
 * If a session exists, it returns the user object.
 *
 * @returns {Response} JSON array of Board objects with _count metadata
 *
 * @example
 * // Response:
 * [
 *   {
 *     id: "clx1234567890",
 *     name: "Sprint 42",
 *     ownerId: "user_abc",
 *     createdAt: "2024-01-15T10:30:00Z",
 *     updatedAt: "2024-01-20T14:45:00Z",
 *     _count: {
 *       members: 4,
 *       todos: 7
 *     }
 *   },
 *   ...
 * ]
 */
export async function GET() {
  // Step 1: Authenticate — get the current user's session
  const session = await getRequiredSession()
  
  // Step 2: Query the database using the shared fetchBoards function
  const boards = await fetchBoards(session.user.id)
  
  // Step 3: Return the boards as JSON
  return NextResponse.json(boards)
}
