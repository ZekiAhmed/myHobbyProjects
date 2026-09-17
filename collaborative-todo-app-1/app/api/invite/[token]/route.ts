/**
 * @fileoverview GET /api/invite/[token] — Validate an invitation token
 *
 * Returns board name and email for display on the invite page.
 * Does NOT consume the invitation — that happens via acceptInvitation action.
 *
 * RATE LIMITING:
 * This endpoint should be rate-limited to prevent token enumeration.
 * Apply Upstash rate limiting: 30 requests per 60 seconds per IP.
 *
 * @see app/invite/[token]/InviteClient.tsx — Client component that calls this
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { isTokenExpired } from '@/lib/utils/invite-tokens'

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '60 s'),
  analytics: true,
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '127.0.0.1'
  const { success, reset } = await ratelimit.limit(`invite:${ip}`)

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
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
    return NextResponse.json(
      { error: 'Invalid invitation link' },
      { status: 404 }
    )
  }

  if (invitation.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'This invitation has already been used' },
      { status: 410 }
    )
  }

  if (isTokenExpired(invitation.expiresAt)) {
    return NextResponse.json(
      { error: 'This invitation link has expired. Ask the board owner to send a new one.' },
      { status: 410 }
    )
  }

  return NextResponse.json({
    boardName: invitation.board.name,
    email: invitation.email,
  })
}
