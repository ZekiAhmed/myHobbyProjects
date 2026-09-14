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
import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'

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
 * QUERY STRATEGY:
 * We use Prisma's OR filter to find boards where:
 *   1. The user is the owner (ownerId = userId), OR
 *   2. The user is a member (exists in BoardMember table)
 *
 * The `include._count` adds member and open todo counts without fetching the actual records.
 * This is much more efficient than fetching all members/todos just to count them.
 *
 * SORTING:
 * Boards are sorted by updatedAt descending (most recently updated first).
 * This puts the most active boards at the top of the dashboard.
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
  
  // Step 2: Query the database for all boards the user has access to
  const boards = await prisma.board.findMany({
    // WHERE clause: find boards where user is owner OR member
    where: {
      OR: [
        // Option 1: User owns the board
        { ownerId: session.user.id },
        // Option 2: User is a member of the board
        // The `some` operator checks if ANY BoardMember record matches
        {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      ],
    },
    // INCLUDE clause: add metadata without fetching full related records
    include: {
      _count: {
        select: {
          // Count total members (this doesn't include the owner)
          members: true,
          // Count open todos (status != DONE)
          // We filter out DONE todos because the dashboard shows "open todo count"
          todos: {
            where: {
              status: {
                not: 'DONE', // Only count TO_DO and IN_PROGRESS todos
              },
            },
          },
        },
      },
    },
    // ORDER BY: most recently updated boards first
    orderBy: {
      updatedAt: 'desc',
    },
  })
  
  // Step 3: Return the boards as JSON
  // The client (DashboardClient) will receive this and render the board cards
  return NextResponse.json(boards)
}
