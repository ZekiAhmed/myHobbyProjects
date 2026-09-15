/**
 * @fileoverview Board Prisma Queries (Server-Side Only)
 *
 * This file contains shared Prisma database queries for board data.
 * It is used by Server Components and API Routes.
 *
 * IMPORTANT: This is a SERVER-ONLY file.
 * It imports Prisma, which requires Node.js modules (dns, net, etc.).
 * It must NOT be imported by Client Components.
 *
 * CLIENT-SIDE QUERY KEYS: Use lib/queries/board-keys.ts instead.
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns
 */

import { prisma } from '@/lib/db'

/**
 * Fetch all boards the current user has access to (owner OR member).
 *
 * WHAT IT DOES:
 * - Queries the database for boards where the user is the owner or a member
 * - Includes member count and open todo count (_count)
 * - Orders by most recently updated first
 *
 * USED BY:
 * - app/(app)/page.tsx (Server Component — passes data as props)
 * - app/api/boards/route.ts (API Route — returns JSON)
 *
 * WHY SHARED?
 * Both the Server Component and the API Route need the same query.
 * Extracting it here prevents the two copies from drifting apart.
 *
 * @returns Array of boards with _count metadata
 */
export async function fetchBoards(userId: string) {
  return prisma.board.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          members: true,
          todos: {
            where: {
              status: {
                not: 'DONE',
              },
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
}
