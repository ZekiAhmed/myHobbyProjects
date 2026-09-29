/**
 * @fileoverview The invite gate at the paid moment
 * (subscription-billing issue 10)
 *
 * CONTRACT UNDER TEST — "the single paid moment is inviting a Member":
 * 1. A free Owner (never subscribed) trying to send an Invitation is
 *    blocked with the upgrade paywall: an authorization refusal
 *    carrying reason "none", no Invitation row, no Activity row, no
 *    email
 * 2. A LAPSED Owner is blocked with the renew prompt (reason
 *    "expired"), not a generic server error
 * 3. A Pro Owner sends an Invitation with no interruption
 * 4. Entitlement is checked AFTER ownership — a stranger is told they
 *    are not the Owner and learns nothing about the Owner's billing
 * 5. Accepting an Invitation is never gated, whatever the Owner's state
 *    (spec story 26: riding on a team subscription is genuinely free)
 *
 * The exact expiry INSTANT belongs to the pure seam
 * (lib/__tests__/subscription.test.ts); here the clock is real, so
 * these tests pin the free / Pro / lapsed split.
 *
 * External behavior only — db, session, headers and email mocked at the
 * module boundary (prior art: actions/__tests__/expiry-lock.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionResult } from '@/lib/errors'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  board: { findUniqueOrThrow: vi.fn() },
  boardMember: { findFirst: vi.fn(), create: vi.fn() },
  invitation: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  activity: { create: vi.fn() },
  $transaction: vi.fn(),
}))
const revalidateTagMock = vi.hoisted(() => vi.fn())
const sendInvitationEmailMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.7' }),
}))
vi.mock('@/lib/email', () => ({ sendInvitationEmail: sendInvitationEmailMock }))

import { createInvitation, acceptInvitation } from '@/app/actions/invitations'

const BOARD_ID = 'board_1'
const OWNER_ID = 'user_owner'
const INVITEE_ID = 'user_invitee'
const INVITATION_ID = 'inv_1'

const NEVER = null
const PRO = new Date(Date.now() + 60 * 60 * 1000)
const LAPSED = new Date(Date.now() - 60 * 60 * 1000)

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

/**
 * Primes the Board the way the gate reads it: the Owner's period end
 * off the `owner` relation `createInvitation` includes. `null` is a
 * subscriber who never paid; a past date is a lapsed one; a future
 * date is Pro.
 */
function primeBoard(subscriptionPeriodEnd: Date | null) {
  prismaMock.board.findUniqueOrThrow.mockResolvedValue({
    id: BOARD_ID,
    ownerId: OWNER_ID,
    name: 'Sprint 42',
    owner: { subscriptionPeriodEnd },
  })
}

/** Asserts the refusal is the paywall, not some other failure. */
function expectPaywall(result: ActionResult<unknown>, reason: 'none' | 'expired') {
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.type).toBe('authorization')
    expect(result.error.reason).toBe(reason)
    expect(result.error.message).toMatch(/Pro/i)
  }
}

/** Nothing behind the gate may run for a refused send. */
function expectNothingSent() {
  expect(prismaMock.$transaction).not.toHaveBeenCalled()
  expect(prismaMock.invitation.create).not.toHaveBeenCalled()
  expect(prismaMock.activity.create).not.toHaveBeenCalled()
  expect(sendInvitationEmailMock).not.toHaveBeenCalled()
  expect(revalidateTagMock).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )
  prismaMock.invitation.findFirst.mockResolvedValue(null)
  prismaMock.invitation.create.mockResolvedValue({
    id: INVITATION_ID,
    boardId: BOARD_ID,
    email: 'invitee@t.dev',
  })
  prismaMock.boardMember.findFirst.mockResolvedValue(null)
})

describe('invite gate — sending an Invitation is the paid moment', () => {
  it('blocks a free Owner with the upgrade paywall', async () => {
    signIn(OWNER_ID)
    primeBoard(NEVER)

    const result = await createInvitation(BOARD_ID, 'invitee@t.dev')

    expectPaywall(result, 'none')
    expectNothingSent()
  })

  it('blocks a lapsed Owner with the renew prompt, not a generic error', async () => {
    signIn(OWNER_ID)
    primeBoard(LAPSED)

    const result = await createInvitation(BOARD_ID, 'invitee@t.dev')

    expectPaywall(result, 'expired')
    if (!result.success) {
      expect(result.error.message).toMatch(/renew/i)
      expect(result.error.message).not.toMatch(/server|unexpected/i)
    }
    expectNothingSent()
  })

  it('lets a Pro Owner send an Invitation with no interruption', async () => {
    signIn(OWNER_ID)
    primeBoard(PRO)

    const result = await createInvitation(BOARD_ID, 'invitee@t.dev')

    expect(result.success).toBe(true)
    expect(prismaMock.invitation.create).toHaveBeenCalledTimes(1)
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1)
    expect(revalidateTagMock).toHaveBeenCalledWith('board-detail', 'max')
  })

  it('checks entitlement only after ownership — a stranger gets the owner-only refusal', async () => {
    signIn(INVITEE_ID)
    primeBoard(NEVER)

    const result = await createInvitation(BOARD_ID, 'someone-else@t.dev')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toMatch(/only the board owner/i)
      expect(result.error.reason).toBeUndefined()
    }
    expectNothingSent()
  })
})

describe('invite gate — accepting an Invitation is never gated', () => {
  function primePendingInvitation() {
    prismaMock.invitation.findUnique.mockResolvedValue({
      id: INVITATION_ID,
      boardId: BOARD_ID,
      email: `${INVITEE_ID}@t.dev`,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    prismaMock.invitation.update.mockResolvedValue({ id: INVITATION_ID, status: 'ACCEPTED' })
    prismaMock.boardMember.create.mockResolvedValue({ id: 'bm_x', boardId: BOARD_ID, userId: INVITEE_ID })
  }

  it('lets an invitee accept an Invitation from a lapsed Owner', async () => {
    signIn(INVITEE_ID)
    primePendingInvitation()

    const result = await acceptInvitation('token')

    expect(result.success).toBe(true)
    expect(prismaMock.boardMember.create).toHaveBeenCalledTimes(1)
  })

  it('lets an invitee accept an Invitation from a free Owner (issued before expiry)', async () => {
    signIn(INVITEE_ID)
    primePendingInvitation()

    const result = await acceptInvitation('token')

    expect(result.success).toBe(true)
    expect(prismaMock.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACCEPTED' } })
    )
  })

  it('never asks an invitee about a subscription — no Owner period end is read on accept', async () => {
    signIn(INVITEE_ID)
    primePendingInvitation()

    await acceptInvitation('token')

    expect(prismaMock.board.findUniqueOrThrow).not.toHaveBeenCalled()
  })
})
