// Used for rate limiting (see actions/invitations.ts and
// app/invite/[token]/page.tsx). Upstash's Redis is REST-based, so unlike
// Prisma there's no connection-pooling concern here — a new "client" is
// really just an object holding a URL + token, safe to reuse.

import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Small helper wrapping the common "fixed window" rate-limit pattern:
 * increment a counter for this key, set it to expire after `windowSeconds`
 * the FIRST time it's created, and reject once the count exceeds `limit`.
 *
 * Used for: invite creation (20/hour/user) and invite-link visits
 * (30/60s/IP) — see actions/invitations.ts.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await redis.incr(key)

  // Only set an expiry the first time this key is created — otherwise every
  // increment would keep pushing the expiry further into the future and the
  // window would never actually reset.
  if (count === 1) {
    await redis.expire(key, windowSeconds)
  }

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  }
}