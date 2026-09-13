import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
vi.stubEnv('RESEND_API_KEY', 'test-api-key')
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret')
vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
