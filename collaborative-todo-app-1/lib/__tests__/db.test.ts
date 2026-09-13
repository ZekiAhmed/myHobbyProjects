import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Prisma module
vi.mock('@/lib/generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
}))

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}))

describe('Prisma client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the global prisma instance
    delete (globalThis as any).prisma
  })

  it('should create a Prisma client instance', async () => {
    const { prisma } = await import('@/lib/db')
    
    expect(prisma).toBeDefined()
    expect(typeof prisma.$connect).toBe('function')
  })

  it('should reuse the same instance in development', async () => {
    process.env.NODE_ENV = 'development'
    
    const { prisma: prisma1 } = await import('@/lib/db')
    const { prisma: prisma2 } = await import('@/lib/db')
    
    expect(prisma1).toBe(prisma2)
  })
})
