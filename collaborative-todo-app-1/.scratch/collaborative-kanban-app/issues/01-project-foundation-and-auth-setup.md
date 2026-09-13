# 01 — Project Foundation & Auth Setup

**What to build:** The complete authentication system — sign up, sign in, sign out, email verification, password reset. Session management with `getRequiredSession()` and `getOptionalSession()`. Cookie-presence guard (`proxy.ts`). Protected route redirection.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Better Auth server instance configured with `emailAndPassword` plugin (min 12 chars, email verification required)
- [ ] Better Auth browser client configured
- [ ] Auth catch-all API route (`/api/auth/[...all]`)
- [ ] `getRequiredSession()` helper — returns session or redirects to `/sign-in`
- [ ] `getOptionalSession()` helper — returns session or null (no redirect)
- [ ] `proxy.ts` — cookie-presence guard, redirects unauthenticated users to `/sign-in?callbackUrl=...`
- [ ] Sign-up page (`/sign-up`) — email + password form, strength meter, creates unverified account, sends verification email
- [ ] Sign-in page (`/sign-in`) — email + password form, handles unverified email state, supports `callbackUrl` redirect
- [ ] Email verification page (`/verify-email`) — "Check your inbox" message, "Resend verification email" link
- [ ] Forgot password page (`/forgot-password`) — enter email, sends reset link
- [ ] Reset password page (`/reset-password?token=...`) — enter new password, validates token server-side
- [ ] Sign-out action — deletes session from DB, clears cookie, redirects to `/sign-in`
- [ ] Prisma singleton (`lib/db.ts`) with development logging
- [ ] Resend SDK wrapper (`lib/email.ts`) for sending verification and reset emails
- [ ] Upstash Redis client singleton (`lib/redis.ts`) for rate limiting