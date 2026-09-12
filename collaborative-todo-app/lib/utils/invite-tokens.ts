// SECURITY-CRITICAL FILE. Read this before touching invite tokens anywhere
// else in the codebase.
//
// Prisma's `cuid()` (used for record IDs like User.id, List.id, etc.) is
// convenient but PARTIALLY PREDICTABLE — it embeds a timestamp and a
// per-process counter. That's totally fine for internal primary keys nobody
// sees. It is NOT fine for an invite token, which:
//   (a) grants access to a list just by knowing the string, and
//   (b) is exposed directly in a URL that could be logged, shared, or
//       guessed if predictable.
//
// So: invite tokens are generated here, with Node's built-in `crypto`
// module, as 256 bits (32 bytes) of cryptographically secure randomness.
// That's effectively unguessable — brute-forcing it isn't feasible even
// combined with the rate limiting on the invite-accept endpoint.

import { randomBytes } from 'crypto'

/** Generates a new, cryptographically secure invite token. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex') // 64 hex characters = 256 bits of entropy
}

/** An invite is valid to accept only if it's still PENDING and not expired. */
export function isInviteValid(invitation: { status: string; expiresAt: Date }): boolean {
  return invitation.status === 'PENDING' && invitation.expiresAt > new Date()
}

/** Computes the expiry timestamp for a freshly created invite: now + 48h. */
export function getInviteExpiry(): Date {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000
  return new Date(Date.now() + FORTY_EIGHT_HOURS_MS)
}