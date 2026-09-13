/**
 * @fileoverview Upstash Redis Client Singleton
 * 
 * This module creates and exports a singleton instance of the Upstash Redis client.
 * Upstash is a serverless Redis service that's perfect for Next.js applications.
 * 
 * WHY UPSTASH REDIS?
 * - Serverless-friendly (no persistent connections)
 * - Pay-per-request pricing (cost-effective for small apps)
 * - REST API (works everywhere, including edge runtimes)
 * - Built-in rate limiting support
 * 
 * USE CASES IN THIS APP:
 * - Rate limiting on authentication endpoints
 * - Rate limiting on invitation creation
 * - Caching frequently accessed data (future use)
 * 
 * @see https://upstash.com/docs/redis
 */

import { Redis } from '@upstash/redis'

/**
 * TypeScript trick to store the Redis instance on the global object.
 * 
 * Same pattern as lib/db.ts - prevents multiple instances during hot-reloads.
 * 
 * @see lib/db.ts for detailed explanation of the singleton pattern
 */
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

/**
 * Export the singleton Redis client instance.
 * 
 * HOW IT WORKS:
 * 1. First request: `globalForRedis.redis` is undefined, so we create a new client
 * 2. Subsequent requests: `globalForRedis.redis` exists, so we reuse it
 * 
 * The `??` (nullish coalescing) operator returns the left operand if it's not
 * null/undefined, otherwise returns the right operand.
 * 
 * UPSTASH CONFIGURATION:
 * - url: The REST endpoint URL from Upstash dashboard
 * - token: Authentication token from Upstash dashboard
 * 
 * IMPORTANT: These environment variables must be set in .env:
 * UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
 * UPSTASH_REDIS_REST_TOKEN=xxxx
 */
export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

/**
 * Store the Redis instance on globalThis in development.
 * 
 * WHY only in development?
 * - Same reason as Prisma: prevent memory leaks in production
 * - Production environments don't have hot-reloads
 */
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
