/**
 * @fileoverview Server-entrypoint tests for platform role management
 * (subscription-billing issue 01)
 *
 * CONTRACT UNDER TEST:
 *
 * promoteAdministrator:
 * 1. An Administrator promoting a regular user sets that user's role
 * 2. A regular signed-in user is blocked (authorization) with no writes
 * 3. Promoting an unknown user or an existing Administrator is refused
 *    as a validation error with no writes
 *
 * demoteAdministrator:
 * 4. An Administrator demotes another Administrator in one transaction
 * 5. Self-demotion is refused (authorization) — the actor keeps the role
 * 6. Demoting the last remaining Administrator is refused (validation) —
 *    the target keeps the role, nothing is written
 * 7. A regular signed-in user is blocked before any transaction starts
 * 8. Demoting someone who is not an Administrator is refused (validation) —
 *    distinct from the last-admin guard
 *
 * External behavior only — session and db mocked at the module boundary;
 * the fake user rows behave as the database state the guards read and
 * write (prior art: actions/__tests__/notifications.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const sessionMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  getPlatformRole: vi.fn(),
}))
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getRequiredSession: async () => sessionMock.getSession(),
  getPlatformRole: (userId: string) => sessionMock.getPlatformRole(userId),
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { promoteAdministrator, demoteAdministrator } from '@/actions/admin'

const ACTOR_ADMIN_ID = 'user_admin'
const ADMIN_TWO_ID = 'user_admin_two'
const REGULAR_ID = 'user_regular'
const MISSING_ID = 'user_missing'

type Role = 'REGULAR' | 'ADMINISTRATOR'

/** Fake database: role rows the guards read and the writes mutate. */
let db: Record<string, { id: string; role: Role }>

function seed(users: Array<{ id: string; role: Role }>) {
  db = Object.fromEntries(users.map((u) => [u.id, { ...u }]))
}

async function findUser({ where }: { where: { id: string } }) {
  return db[where.id] ? { ...db[where.id] } : null
}

async function updateUser({ where, data }: { where: { id: string }; data: { role: Role } }) {
  db[where.id] = { ...db[where.id], role: data.role }
  return { ...db[where.id] }
}

async function countUsers({ where }: { where: { role: Role } }) {
  return Object.values(db).filter((u) => u.role === where.role).length
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev` },
    session: { id: 's1' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockImplementation(findUser)
  prismaMock.user.update.mockImplementation(updateUser)
  prismaMock.user.count.mockImplementation(countUsers)
  // getPlatformRole reads the same fake rows the guards use
  sessionMock.getPlatformRole.mockImplementation(
    async (userId: string) => db[userId]?.role ?? null
  )
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: {
        findUnique: prismaMock.user.findUnique,
        count: prismaMock.user.count,
        update: prismaMock.user.update,
      },
    })
  )
})

describe('promoteAdministrator', () => {
  it('promotes a regular user when the actor is an Administrator', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: REGULAR_ID, role: 'REGULAR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    const result = await promoteAdministrator(REGULAR_ID)

    expect(result.success).toBe(true)
    expect(db[REGULAR_ID].role).toBe('ADMINISTRATOR')
  })

  it('refuses a regular actor with an authorization error and writes nothing', async () => {
    seed([
      { id: REGULAR_ID, role: 'REGULAR' },
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(REGULAR_ID)

    const result = await promoteAdministrator(ACTOR_ADMIN_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(db[ACTOR_ADMIN_ID].role).toBe('ADMINISTRATOR')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses an unknown target as a validation error', async () => {
    seed([{ id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' }])
    signIn(ACTOR_ADMIN_ID)

    const result = await promoteAdministrator(MISSING_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
    }
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses to promote an existing Administrator', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    const result = await promoteAdministrator(ADMIN_TWO_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
    }
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('demoteAdministrator', () => {
  it('demotes another Administrator when the actor is an Administrator', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    const result = await demoteAdministrator(ADMIN_TWO_ID)

    expect(result.success).toBe(true)
    expect(db[ADMIN_TWO_ID].role).toBe('REGULAR')
    // the actor is untouched
    expect(db[ACTOR_ADMIN_ID].role).toBe('ADMINISTRATOR')
  })

  it('refuses self-demotion — the actor keeps the Administrator role', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    const result = await demoteAdministrator(ACTOR_ADMIN_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
      expect(result.error.message).toMatch(/yourself/i)
    }
    expect(db[ACTOR_ADMIN_ID].role).toBe('ADMINISTRATOR')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses to demote the last remaining Administrator', async () => {
    // The race this guard exists for: two Administrators demote each other
    // concurrently. The second transaction passes its own role check, then
    // sees a committed count of 1 — demoting now would leave nobody able to
    // approve payments, so the write must not happen.
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(ACTOR_ADMIN_ID)
    prismaMock.user.count.mockResolvedValue(1)

    const result = await demoteAdministrator(ADMIN_TWO_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
      expect(result.error.message).toMatch(/at least one administrator/i)
    }
    expect(db[ACTOR_ADMIN_ID].role).toBe('ADMINISTRATOR')
    expect(db[ADMIN_TWO_ID].role).toBe('ADMINISTRATOR')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses a regular actor before any transaction starts', async () => {
    seed([
      { id: REGULAR_ID, role: 'REGULAR' },
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(REGULAR_ID)

    const result = await demoteAdministrator(ACTOR_ADMIN_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('authorization')
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(db[ACTOR_ADMIN_ID].role).toBe('ADMINISTRATOR')
  })

  it('refuses to demote someone who is not an Administrator (validation)', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: REGULAR_ID, role: 'REGULAR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    const result = await demoteAdministrator(REGULAR_ID)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.type).toBe('validation')
      expect(result.error.message).toMatch(/not an administrator/i)
    }
    expect(db[REGULAR_ID].role).toBe('REGULAR')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('evaluates the guards and the write inside one transaction', async () => {
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    signIn(ACTOR_ADMIN_ID)

    await demoteAdministrator(ADMIN_TWO_ID)

    // one transaction, run at Serializable isolation so two Administrators
    // demoting each other concurrently cannot both pass the count guard
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    })
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)

    // Failure path runs in a single transaction too: guards first, no write.
    prismaMock.$transaction.mockClear()
    prismaMock.user.update.mockClear()
    seed([
      { id: ACTOR_ADMIN_ID, role: 'ADMINISTRATOR' },
      { id: ADMIN_TWO_ID, role: 'ADMINISTRATOR' },
    ])
    prismaMock.user.count.mockResolvedValue(1)

    const failed = await demoteAdministrator(ADMIN_TWO_ID)

    expect(failed.success).toBe(false)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(db[ADMIN_TWO_ID].role).toBe('ADMINISTRATOR')
  })
})
