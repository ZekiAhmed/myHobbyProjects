// Server Actions for creating, renaming, and deleting a List.
// These are "pure CRUD" per the TDD's feature map — no optimistic UI is
// needed for them (unlike quick-complete or drag reordering), because the
// dashboard/settings UI already shows a natural loading state while these
// run (e.g. a disabled button + spinner).

'use server'

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { updateTag } from 'next/cache'

/**
 * Creates a new List, owned by the currently logged-in user.
 * Any authenticated user can create a list — there's no special permission
 * needed, since they automatically become its owner.
 */
export async function createList(name: string) {
  // STEP 1: Authenticate. getRequiredSession() redirects to /sign-in on its
  // own if there's no valid session, so by the time we reach the next line
  // we KNOW `session.user` is real.
  const session = await getRequiredSession()

  if (!name.trim()) {
    throw new Error('List name is required')
  }

  // STEP 3: Mutate (no authorization step needed here — anyone can create
  // a list; they just become its owner).
  const list = await prisma.list.create({
    data: {
      name: name.trim(),
      ownerId: session.user.id,
    },
  })

  // STEP 4: Invalidate the Next.js server-side fetch cache for the "lists"
  // tag, so the next Server Component render of the dashboard sees fresh
  // data instead of a stale cached response.
  updateTag('lists')

  // STEP 5: Return data the client needs. The dashboard's "New List" modal
  // uses `list.id` to redirect straight to the new board.
  return { success: true, list }
}

/** Renames an existing List. Owner-only. */
export async function renameList(listId: string, name: string) {
  const session = await getRequiredSession()

  if (!name.trim()) {
    throw new Error('List name is required')
  }

  // STEP 2: Authorize. We fetch just enough of the List to check ownership
  // — findUniqueOrThrow means a bad/missing listId surfaces as a clear
  // error rather than silently doing nothing.
  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } })

  if (list.ownerId !== session.user.id) {
    throw new Error('Forbidden: only the list owner can rename this list')
  }

  await prisma.list.update({
    where: { id: listId },
    data: { name: name.trim() },
  })

  updateTag('lists')
  updateTag('list-detail')

  return { success: true }
}

/**
 * Permanently deletes a List and EVERYTHING inside it (todos, tags,
 * memberships, invitations) via the `onDelete: Cascade` relations defined
 * in schema.prisma. Owner-only, and irreversible — the UI must confirm
 * this with the user before calling it (see components in §11).
 */
export async function deleteList(listId: string) {
  const session = await getRequiredSession()

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } })

  if (list.ownerId !== session.user.id) {
    throw new Error('Forbidden: only the list owner can delete this list')
  }

  // Thanks to `onDelete: Cascade` on List's related models, this single
  // call also removes every ListMember, Todo, Tag, TodoTag, and Invitation
  // row tied to this list. No manual cleanup queries needed.
  await prisma.list.delete({ where: { id: listId } })

  updateTag('lists')

  return { success: true }
}


// REASON OF USING 'updateTag()' instead of 'revalidateTag()
//================================================================


// Based on your code, you should use **`updateTag('lists')`** and **`updateTag('list-detail')`** instead of `revalidateTag`.

// **Reasons for using `updateTag` in your specific file:**

// * **It aligns with your user experience requirement**: Creating, renaming, or deleting a list are immediate, user-driven mutations ("Read-Your-Own-Writes"). When a user renames a list and the action finishes, they expect to instantly see the new name. `updateTag` immediately purges the cache so the server component re-renders with fresh data straight away, preventing temporary flickers of stale list names.
// * **Your file consists entirely of `'use server'` Actions**: `updateTag` is explicitly built for Server Actions. `revalidateTag` with `'max'` is intended for background SWR invalidations (like CMS webhooks or Route Handlers), whereas Server Actions benefit from immediate cache purging.
// * **Cleaner syntax without arbitrary cache profiles**: Calling `revalidateTag('lists', 'max')` forces you to re-declare a `'max'` cache life profile inside a mutation action, which adds unnecessary boilerplate compared to a direct `updateTag('lists')`.