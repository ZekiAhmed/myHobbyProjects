/**
 * @fileoverview Test Setup File
 * 
 * This file runs before all tests in the test suite.
 * It sets up the test environment by mocking environment variables.
 * 
 * WHY MOCK ENVIRONMENT VARIABLES?
 * - Tests should not depend on real API keys or database connections
 * - Prevents accidental data loss or API charges during testing
 * - Makes tests reproducible (same results every time)
 * - Allows tests to run in any environment (CI, local, etc.)
 * 
 * @see https://vitest.dev/config/#setupfiles
 */

import { vi } from 'vitest'

/**
 * Mock environment variables using Vitest's stubEnv.
 * 
 * These variables are used by:
 * - lib/db.ts (DATABASE_URL)
 * - lib/auth.ts (NEXT_PUBLIC_APP_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL)
 * - lib/email.ts (RESEND_API_KEY, NEXT_PUBLIC_APP_URL)
 * - lib/redis.ts (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 * 
 * The values are fake test values - they won't connect to real services.
 * 
 * IMPORTANT: vi.stubEnv() replaces process.env for the duration of the test.
 * After tests complete, the original values are restored.
 */
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
vi.stubEnv('RESEND_API_KEY', 'test-api-key')
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
