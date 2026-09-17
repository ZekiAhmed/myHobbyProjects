# 01 — Project Foundation & Auth Setup

**What to build:** The complete authentication system — sign up, sign in, sign out, email verification, password reset. Session management with `getRequiredSession()` and `getOptionalSession()`. Cookie-presence guard (`proxy.ts`). Protected route redirection.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Better Auth server instance configured with `emailAndPassword` plugin (min 12 chars, email verification required)
- [x] Better Auth browser client configured
- [x] Auth catch-all API route (`/api/auth/[...all]`)
- [x] `getRequiredSession()` helper — returns session or redirects to `/sign-in`
- [x] `getOptionalSession()` helper — returns session or null (no redirect)
- [x] `proxy.ts` — cookie-presence guard, redirects unauthenticated users to `/sign-in?callbackUrl=...`
- [x] Sign-up page (`/sign-up`) — email + password form, strength meter, creates unverified account, sends verification email
- [x] Sign-in page (`/sign-in`) — email + password form, handles unverified email state, supports `callbackUrl` redirect
- [x] Email verification page (`/verify-email`) — "Check your inbox" message, "Resend verification email" link
- [x] Forgot password page (`/forgot-password`) — enter email, sends reset link
- [x] Reset password page (`/reset-password?token=...`) — enter new password, validates token server-side
- [x] Sign-out action — deletes session from DB, clears cookie, redirects to `/sign-in`
- [x] Prisma singleton (`lib/db.ts`) with development logging
- [x] Resend SDK wrapper (`lib/email.ts`) for sending verification and reset emails
- [x] Upstash Redis client singleton (`lib/redis.ts`) for rate limiting