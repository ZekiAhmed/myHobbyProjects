/**
 * @fileoverview Gate test for the minimal admin area (subscription-billing 01)
 *
 * CONTRACT UNDER TEST (GET /admin, rendered):
 * 1. An Administrator renders the admin area — no forbidden, no redirect
 * 2. A signed-in regular user gets the forbidden() interrupt (HTTP 403 via
 *    the forbidden boundary) and never sees the admin area
 * 3. A signed-out visitor is redirected to /sign-in without any role lookup
 * 4. The Administrator sees every user with their platform role, so the
 *    in-app promote/demote controls (RoleManager) have data to act on
 * 5. The Administrator sees the pricing/bank-details form seeded with the
 *    current settings record; when the row is missing, the form still
 *    shows the 100 ETB defaults from an in-memory fallback — rendering
 *    never writes (the migration owns the first-run seed)
 * 6. A regular user is rejected before any settings read happens — the
 *    record is Administrator-only on the read path too
 *
 * The real requireAdmin gate runs in this test — only the session source,
 * the database, and the Next interrupts are mocked at the module boundary
 * (prior art: app/(app)/boards/[id]/__tests__/page.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { forbidden, redirect } from 'next/navigation'

const sessionMock = vi.hoisted(() => ({ getSession: vi.fn() }))
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  pricingSettings: { findUnique: vi.fn(), create: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => sessionMock.getSession() } },
}))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    forbidden: vi.fn(() => {
      throw new Error('NEXT_FORBIDDEN')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    }),
  }
})

import AdminPage from '@/app/(app)/admin/page'
import { PRICING_SETTINGS_ID } from '@/lib/pricing-settings-schema'

const ADMIN_ID = 'user_admin'
const REGULAR_ID = 'user_regular'

const SETTINGS_ROW = {
  id: PRICING_SETTINGS_ID,
  price: 250,
  currency: 'ETB',
  accountHolder: 'Acme Inc',
  accountNumber: '123456789012',
  bankName: 'Awash Bank',
  transferInstructions: 'Include your payment reference in the memo.',
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-02'),
}

function signIn(userId: string) {
  sessionMock.getSession.mockResolvedValue({
    user: { id: userId, email: `${userId}@t.dev`, name: 'Test User' },
    session: { id: 's1' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // an existing settings record resolves for every render that reaches it
  prismaMock.pricingSettings.findUnique.mockResolvedValue(SETTINGS_ROW)
})

describe('admin page gate (platform Administrator only)', () => {
  it('renders the admin area for an Administrator', async () => {
    signIn(ADMIN_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMINISTRATOR' })

    const el = await AdminPage()

    expect(el).toBeTruthy()
    expect(JSON.stringify(el)).toContain('Administration')
    expect(forbidden).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('denies a signed-in regular user with the forbidden interrupt (403)', async () => {
    signIn(REGULAR_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'REGULAR' })

    await expect(AdminPage()).rejects.toThrow('NEXT_FORBIDDEN')
    expect(forbidden).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects a signed-out visitor to sign-in without a role lookup', async () => {
    sessionMock.getSession.mockResolvedValue(null)

    await expect(AdminPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(forbidden).not.toHaveBeenCalled()
  })
})

describe('admin area content (in-app role management)', () => {
  it('passes every user and their platform role to the role manager', async () => {
    signIn(ADMIN_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMINISTRATOR' })
    prismaMock.user.findMany.mockResolvedValue([
      { id: ADMIN_ID, name: 'Admin', email: 'admin@t.dev', role: 'ADMINISTRATOR' },
      { id: REGULAR_ID, name: 'Regular', email: 'regular@t.dev', role: 'REGULAR' },
    ])

    const el = await AdminPage()
    const json = JSON.stringify(el)

    expect(prismaMock.user.findMany).toHaveBeenCalledTimes(1)
    // user rows reach the client controls
    expect(json).toContain('regular@t.dev')
    expect(json).toContain('admin@t.dev')
    expect(json).toContain('REGULAR')
    // the signed-in actor id accompanies them (self-row rendering)
    expect(json).toContain(ADMIN_ID)
  })
})

describe('admin area content (pricing & bank-details settings)', () => {
  it('seeds the pricing form with the current settings record for an Administrator', async () => {
    signIn(ADMIN_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMINISTRATOR' })
    prismaMock.user.findMany.mockResolvedValue([])

    const el = await AdminPage()
    const json = JSON.stringify(el)

    expect(prismaMock.pricingSettings.findUnique).toHaveBeenCalledWith({
      where: { id: PRICING_SETTINGS_ID },
    })
    // the persisted values reach the form fields
    expect(json).toContain('"price":250')
    expect(json).toContain('Awash Bank')
    expect(json).toContain('123456789012')
    // reading is read-only
    expect(prismaMock.pricingSettings.create).not.toHaveBeenCalled()
  })

  it('falls back to the 100 ETB seed defaults when no record exists — without writing', async () => {
    signIn(ADMIN_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMINISTRATOR' })
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.pricingSettings.findUnique.mockResolvedValue(null)

    const el = await AdminPage()
    const json = JSON.stringify(el)

    expect(prismaMock.pricingSettings.create).not.toHaveBeenCalled()
    expect(json).toContain('"price":100')
    expect(json).toContain('"currency":"ETB"')
  })

  it('rejects a regular user before any settings read happens', async () => {
    signIn(REGULAR_ID)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'REGULAR' })

    await expect(AdminPage()).rejects.toThrow('NEXT_FORBIDDEN')
    expect(prismaMock.pricingSettings.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.pricingSettings.create).not.toHaveBeenCalled()
  })
})
