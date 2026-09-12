// A single list's METADATA — name, members, tags. Deliberately does NOT
// include todos (see the sibling /todos route below) — todos poll every
// 8 seconds, but members/tags change rarely, so splitting them into two
// endpoints with two different cache lifetimes avoids re-fetching
// member/tag data on every single poll tick.

import { prisma } from '@/lib/db'
import { getRequiredSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getRequiredSession()

  const list = await prisma.list.findUnique({ where: { id } })
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  // MEMBERSHIP CHECK: confirm this user is either the owner or a member
  // before returning ANY data about this list. This is the authorization
  // boundary the TDD's security section describes — proxy.ts and
  // getRequiredSession() only proved "this is a real, logged-in user,"
  // NOT "this user is allowed to see THIS list."
  const isOwner = list.ownerId === session.user.id
  const membership = isOwner
    ? null
    : await prisma.listMember.findFirst({
        where: { listId: id, userId: session.user.id },
      })

  if (!isOwner && !membership) {
    return new Response('Forbidden', { status: 403 })
  }

  // Fetch members and tags together in one round-trip via $transaction —
  // this is faster than two sequential awaited queries because Prisma
  // sends both as a single batched request to Postgres.
  const [members, tags] = await prisma.$transaction([
    prisma.listMember.findMany({
      where: { listId: id },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    prisma.tag.findMany({ where: { listId: id } }),
  ])

  return NextResponse.json({
    id: list.id,
    name: list.name,
    ownerId: list.ownerId,
    isOwner,
    members: members.map((m) => m.user),
    tags,
  })
}