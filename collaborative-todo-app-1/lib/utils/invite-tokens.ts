/**
 * @fileoverview Invite Token Generation & Validation Helpers
 *
 * This module provides utilities for generating and validating invitation tokens.
 *
 * SECURITY CRITICAL:
 * - Tokens MUST be generated with crypto.randomBytes(32).toString('hex')
 * - NEVER use cuid() for invite tokens — CUIDs are time-based and partially predictable
 * - 256-bit random tokens are cryptographically secure against brute-force attacks
 *
 * TOKEN LIFECYCLE:
 * 1. Owner invites a user by email
 * 2. Token is generated and stored in the Invitation table with 48h expiry
 * 3. Invite link is sent: /invite/[token]
 * 4. When the link is clicked, the token is validated:
 *    - Must exist in the database
 *    - Must not be expired (48h window)
 *    - Must have PENDING status
 *
 * @see prisma/schema.prisma — Invitation model
 */

import crypto from 'crypto'

/** Invitation token expiry duration in milliseconds (48 hours) */
const INVITATION_EXPIRY_MS = 48 * 60 * 60 * 1000

/**
 * Generates a cryptographically secure invitation token.
 *
 * Uses Node.js crypto.randomBytes() for true randomness.
 * Returns a 64-character hex string (256 bits of entropy).
 *
 * WHY 32 BYTES?
 * - 32 bytes = 256 bits = 2^256 possible tokens
 * - Brute-forcing this would take longer than the age of the universe
 * - NIST recommends at least 128 bits for security tokens; we use 256
 *
 * @returns A 64-character lowercase hex string
 *
 * @example
 * const token = generateInviteToken()
 * // "a1b2c3d4e5f6..." (64 hex characters)
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Calculates the expiry date for a new invitation token.
 *
 * Returns a Date object 48 hours in the future.
 * This is stored in the Invitation table's expiresAt field.
 *
 * @returns Date object representing 48 hours from now
 *
 * @example
 * const expiresAt = getInvitationExpiry()
 * // Date { 2026-09-20T00:57:00.000Z } (48h from now)
 */
export function getInvitationExpiry(): Date {
  return new Date(Date.now() + INVITATION_EXPIRY_MS)
}

/**
 * Checks whether an invitation token has expired.
 *
 * @param expiresAt - The expiry date from the Invitation record
 * @returns true if the token has expired, false if still valid
 *
 * @example
 * const invitation = await prisma.invitation.findUnique({ where: { token } })
 * if (isTokenExpired(invitation.expiresAt)) {
 *   throw new Error('This invite link has expired')
 * }
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}
