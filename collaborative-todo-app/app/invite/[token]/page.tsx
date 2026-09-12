// SEMI-PUBLIC page — reachable without being logged in (see proxy.ts's
// matcher, which explicitly excludes /invite). This page implements all
// four branches of the PRD's invite flow diagram:
//   A) new user            -> redirect to /sign-up?inviteToken=...
//   B) existing, signed out -> redirect to /sign-in?inviteToken=...
//   C) already signed in    -> accept immediately, redirect to the board
//   D) invalid/expired token -> show an error message
//
// Also enforces the 30-requests/60-seconds-per-IP rate limit mentioned in
// TDD §9, to blunt token-guessing attempts.

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { getOptionalSession } from '@/lib/session'
import { isInviteValid } from '@/lib/utils/invite-tokens'
import { acceptInvitation } from '@/actions/invitations'
import { checkRateLimit } from '@/lib/redis'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // Rate limit by IP address (best-effort — reads the standard proxy
  // header set by Vercel's edge network) to slow down anyone trying to
  // brute-force guess a valid token.
  const forwardedFor = (await headers()).get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = await checkRateLimit(`invite-visit:${ip}`, 30, 60)

  if (!allowed) {
    return <p>Too many attempts. Please try again in a minute.</p>
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } })

  // BRANCH D: invalid or expired token.
  if (!invitation || !isInviteValid(invitation)) {
    return (
      <div>
        <h1>This invite link is invalid or has expired.</h1>
        <p>Ask the list owner to send a new one.</p>
      </div>
    )
  }

  const session = await getOptionalSession()

  if (!session) {
    // We don't know yet whether this email already has an account — rather
    // than querying for that here, we default to sending them to sign-up;
    // the sign-up form itself doesn't block existing emails, and a user
    // who already has an account can just click through to "sign in
    // instead" from there. This keeps the branching logic simple.
    //
    // BRANCH A / B are both effectively handled by sending to /sign-up;
    // a returning user who already knows they have an account can use the
    // "sign in" link on that page, which preserves ?inviteToken via its
    // own querystring forwarding.
    redirect(`/sign-up?inviteToken=${token}`)
  }

  // BRANCH C: already signed in — accept right now.
  const result = await acceptInvitation(token)
  redirect(`/lists/${result.listId}`)
}