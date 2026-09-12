// Self-service account management: change display name, change password,
// and the GDPR "right to erasure" delete-account flow.

'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getRequiredSession } from '@/lib/session'
import { headers } from 'next/headers'
import { updateTag } from 'next/cache'

/** Updates the current user's display name. */
export async function updateName(name: string) {
  const session = await getRequiredSession()

  if (!name.trim()) {
    throw new Error('Name is required')
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  })

  updateTag('user')
  return { success: true }
}

/**
 * Changes the current user's password. Delegates the actual verification
 * ("does currentPassword match what's on file?") and hashing of the new
 * password to Better Auth, rather than reimplementing bcrypt logic here —
 * Better Auth already owns the Account.password column.
 */
export async function updatePassword(currentPassword: string, newPassword: string) {
  await getRequiredSession() // just confirms the caller is logged in

  await auth.api.changePassword({
    body: { currentPassword, newPassword },
    headers: await headers(),
  })

  return { success: true }
}

/**
 * GDPR right-to-erasure: permanently deletes the user and EVERYTHING
 * cascading from them (owned lists and all their todos/tags/members,
 * memberships on others' lists, sessions, accounts).
 *
 * NOTE: this does NOT delete Lists the user is merely a MEMBER of (only
 * lists they OWN) — removing a member's account doesn't destroy a shared
 * team board. It just removes their ListMember row via cascade.
 */
export async function deleteAccount() {
  const session = await getRequiredSession()

  // onDelete: Cascade on List.owner, ListMember.user, Session.user, and
  // Account.user means this single call is enough — Prisma/Postgres does
  // the rest of the cleanup for us.
  await prisma.user.delete({ where: { id: session.user.id } })

  return { success: true }
}