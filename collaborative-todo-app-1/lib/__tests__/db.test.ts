/**
 * @fileoverview Tests for Prisma Client Singleton
 * 
 * This file contains tests for lib/db.ts (Prisma client singleton).
 * 
 * TESTING STRATEGY:
 * - Mock Prisma client and adapter (don't connect to real database)
 * - Test that singleton pattern works correctly
 * - Verify client instance is reused
 * 
 * WHY MOCK PRISMA?
 * - Don't connect to a real database in tests
 * - Don't need a running PostgreSQL instance
 * - Control test outcomes
 * - Make tests fast and deterministic
 * 
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Mock the Prisma client module.
 * 
 * WHY?
 * - We don't want to connect to a real database
 * - We need to verify that PrismaClient is instantiated correctly
 * - We need to control the mock's behavior
 * 
 * WHAT'S MOCKED?
 * - PrismaClient class: Returns a mock instance with $connect and $disconnect methods
 */
vi.mock('@/lib/generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $connect: vi.fn(), // Mock connect method
    $disconnect: vi.fn(), // Mock disconnect method
  })),
}))

/**
 * Mock the Prisma PostgreSQL adapter.
 * 
 * WHY?
 * - The adapter handles database connections
 * - We don't want real database connections in tests
 * - We need to verify that PrismaPg is instantiated correctly
 */
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}))

/**
 * Test suite for Prisma client singleton.
 */
describe('Prisma client', () => {
  /**
   * Clear all mocks and reset global state before each test.
   * 
   * WHY?
   * - Prevents test pollution
   * - Ensures clean state for each test
   * - Resets the global prisma instance
   */
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the global prisma instance to test singleton creation
    delete (globalThis as any).prisma
  })

  /**
   * Test: Should create a Prisma client instance.
   * 
   * SCENARIO:
   * - First time importing lib/db.ts
   * - Should create a new PrismaClient instance
   * - Instance should have expected methods ($connect, $disconnect)
   */
  it('should create a Prisma client instance', async () => {
    // Import the module (this triggers client creation)
    const { prisma } = await import('@/lib/db')
    
    // Verify the client was created
    expect(prisma).toBeDefined()
    // Verify the client has expected methods
    expect(typeof prisma.$connect).toBe('function')
    expect(typeof prisma.$disconnect).toBe('function')
  })

  /**
   * Test: Should reuse the same instance in development.
   * 
   * SCENARIO:
   * - Multiple imports of lib/db.ts in development mode
   * - Should return the same PrismaClient instance (singleton pattern)
   * - This prevents connection pool exhaustion during hot-reloads
   */
  it('should reuse the same instance in development', async () => {
    // Set NODE_ENV to development (enables singleton pattern)
    process.env.NODE_ENV = 'development'
    
    // Import the module twice
    const { prisma: prisma1 } = await import('@/lib/db')
    const { prisma: prisma2 } = await import('@/lib/db')
    
    // Verify both imports return the same instance
    expect(prisma1).toBe(prisma2)
  })
})
