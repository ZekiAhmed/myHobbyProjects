/**
 * @fileoverview /invite/[token] — Semi-public invite landing page
 *
 * This page handles invitation links sent via email.
 * It's semi-public: accessible without auth, but the token is preserved through sign-in/sign-up.
 *
 * BRANCHES:
 * - Branch A (new user): Redirects to /sign-up?inviteToken=[token]
 * - Branch B (existing user, not signed in): Shows "Sign in" and "Sign up" buttons
 * - Branch C (already signed in): Consumes invitation immediately, redirects to board
 * - Branch D (invalid/expired token): Shows error message
 *
 * SERVER-SIDE SESSION CHECK:
 * Uses getOptionalSession() to check if the user is already signed in.
 * If signed in, consumes the invitation immediately (Branch C).
 * If not signed in, validates the token and shows sign-in/sign-up buttons (Branch A/B).
 *
 * RATE LIMITING:
 * The API endpoint /api/invite/[token] is rate-limited via Upstash Redis (30 req / 60s / IP)
 * to prevent token enumeration brute-force attacks.
 *
 * @see lib/utils/invite-tokens.ts — Token validation
 * @see app/actions/invitations.ts — acceptInvitation action
 */

import { redirect } from 'next/navigation'
import { getOptionalSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { isTokenExpired } from '@/lib/utils/invite-tokens'
import InviteClient from './InviteClient'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const session = await getOptionalSession()

  if (session) {
    try {
      const { acceptInvitation } = await import('@/app/actions/invitations')
      const result = await acceptInvitation(token)
      redirect(`/boards/${result.boardId}`)
    } catch {
      // If invitation consumption fails, show error via client component
      return <InviteClient token={token} />
    }
  }

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      board: {
        select: { name: true },
      },
    },
  })

  if (!invitation) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Invalid</h1>
        <p className="text-gray-600 mb-6">This invite link is invalid.</p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    )
  }

  if (invitation.status !== 'PENDING') {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Used</h1>
        <p className="text-gray-600 mb-6">This invitation has already been used.</p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    )
  }

  if (isTokenExpired(invitation.expiresAt)) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Expired</h1>
        <p className="text-gray-600 mb-6">
          This invitation link has expired. Ask the board owner to send a new one.
        </p>
        <a
          href="/"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Go to Dashboard
        </a>
      </div>
    )
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;ve been invited!</h1>
      <p className="text-gray-600 mb-6">
        Join <span className="font-semibold">{invitation.board.name}</span> on Kanban
      </p>

      <div className="space-y-3">
        <a
          href={`/sign-in?inviteToken=${token}`}
          className="block w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Sign in to join
        </a>
        <a
          href={`/sign-up?inviteToken=${token}`}
          className="block w-full bg-white text-blue-600 border border-blue-600 py-2 px-4 rounded-md hover:bg-blue-50"
        >
          Create an account to join
        </a>
      </div>
    </div>
  )
}
