// One card per list on the dashboard. Purely presentational — all the
// interesting logic (fetching, grouping) lives in DashboardClient.tsx.

import Link from 'next/link'

type ListCardProps = {
  list: {
    id: string
    name: string
    memberCount: number
    openTodoCount: number
  }
}

export function ListCard({ list }: ListCardProps) {
  return (
    // Link (not a plain <a>) gives us Next.js client-side navigation —
    // clicking straight into a board feels instant rather than a full
    // page reload.
    <Link href={`/lists/${list.id}`}>
      <h3>{list.name}</h3>
      <p>
        {list.memberCount} member{list.memberCount === 1 ? '' : 's'} ·{' '}
        {list.openTodoCount} open todo{list.openTodoCount === 1 ? '' : 's'}
      </p>
    </Link>
  )
}