/**
 * @fileoverview Dashboard Page (Server Component)
 *
 * This is the root page of the authenticated app (route: /).
 * It displays all boards the user owns or is a member of.
 *
 * SERVER COMPONENT + PREFETCHING:
 * This is a Server Component that runs on the server during the initial request.
 * It queries the database directly and passes data to the client via props.
 *
 * WHY QUERY DATABASE DIRECTLY INSTEAD OF fetch('/api/boards')?
 * Server Components can't pass cookies to internal fetch() calls.
 * When we call fetch('/api/boards') from a Server Component, the session
 * cookie isn't forwarded, so the API route returns 401/redirect.
 * Querying the database directly avoids this issue.
 *
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/patterns
 */

import { Suspense } from 'react'
import { getRequiredSession } from '@/lib/session'
import { fetchBoards } from '@/lib/queries/boards'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

/**
 * Dashboard Page — Server Component
 *
 * This component runs on the server and fetches board data directly from the database.
 * It passes the data as props to the Client Component.
 *
 * @returns The dashboard UI
 */
export default async function DashboardPage() {
  // Step 1: Authenticate — get the current user's session
  const session = await getRequiredSession()

  // Step 2: Query the database for all boards the user has access to
  // Uses the shared fetchBoards function from lib/queries/boards.ts
  const boards = await fetchBoards(session.user.id)

  // Step 3: Pass the data to the Client Component as props
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardClient initialBoards={boards} currentUserId={session.user.id} />
    </Suspense>
  )
}
