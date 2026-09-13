/**
 * @fileoverview Prisma Database Client Singleton
 * 
 * This module creates and exports a singleton instance of the Prisma client.
 * A singleton pattern ensures that only ONE instance of the Prisma client exists
 * throughout the application's lifecycle, even during hot-reloads in development.
 * 
 * WHY THIS MATTERS:
 * - In development, Next.js hot-reloads modules when files change
 * - Without a singleton, each hot-reload would create a NEW database connection
 * - This leads to connection pool exhaustion and "too many connections" errors
 * - The singleton pattern prevents this by reusing the same connection
 * 
 * @see https://www.prisma.io/docs/orm/more/help-and-troubleshooting/nextjs-help
 */

import { PrismaClient } from '@/lib/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * TypeScript trick to store the Prisma instance on the global object.
 * 
 * WHY globalThis?
 * - In Node.js, `global` is the global object
 * - In browsers, `window` is the global object
 * - `globalThis` works in BOTH environments (ES2020 standard)
 * - This allows the singleton to persist across hot-reloads
 * 
 * The `as unknown as { prisma: PrismaClient | undefined }` cast is necessary
 * because TypeScript doesn't know about our custom property on globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Creates a new Prisma client instance with PostgreSQL adapter.
 * 
 * WHY PrismaPg adapter?
 * - Prisma 7+ uses driver adapters for database connections
 * - PrismaPg is the official PostgreSQL adapter
 * - It manages connection pooling automatically
 * - Better performance than the built-in connection method
 * 
 * @returns A configured PrismaClient instance
 */
const createPrismaClient = () => {
  // Create the PostgreSQL adapter with connection string from environment
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  
  // Create the Prisma client with logging configuration
  return new PrismaClient({
    adapter,
    /**
     * LOGGING CONFIGURATION:
     * - In development: Log queries, errors, and warnings (helps debugging)
     * - In production: Only log errors (reduces noise and improves performance)
     * 
     * Query logging shows every SQL query executed - useful for debugging
     * but too verbose for production
     */
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

/**
 * Export the singleton Prisma client instance.
 * 
 * HOW IT WORKS:
 * 1. First request: `globalForPrisma.prisma` is undefined, so we create a new client
 * 2. Subsequent requests: `globalForPrisma.prisma` exists, so we reuse it
 * 3. During hot-reload: The global persists, so we don't create duplicate connections
 * 
 * The `??` (nullish coalescing) operator returns the left operand if it's not
 * null/undefined, otherwise returns the right operand.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

/**
 * Store the Prisma instance on globalThis in development.
 * 
 * WHY only in development?
 * - Production environments don't have hot-reloads
 * - Production deployments typically have process isolation
 * - Storing on globalThis in production could cause memory leaks
 *   if the application has multiple processes
 */
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
