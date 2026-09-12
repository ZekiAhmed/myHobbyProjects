// This is the SINGLE source of truth for how authentication behaves on the
// server: password rules, session lifetime, rate limits, and what happens
// when Better Auth needs to send an email (verification / password reset).
//
// Everything here is configuration, not something you call directly from
// components — see lib/session.ts for the helpers you actually use in
// Server Components/Actions, and lib/auth-client.ts for the browser side.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const auth = betterAuth({
  // Tell Better Auth to store its Users/Sessions/Accounts in OUR Postgres
  // database via Prisma, using the models we defined in schema.prisma.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  plugins: [
    // Required whenever Better Auth needs to set/read cookies from inside
    // a Next.js Server Action (as opposed to a Route Handler). Without this,
    // sign-in/sign-up called from a Server Action wouldn't actually persist
    // the session cookie in the browser.
    nextCookies(),
  ],

  emailAndPassword: {
    enabled:true,
    // Users can't sign in until they click the verification link in their
    // email. This matches PRD flow: "Sign Up → Check your inbox".
    requireEmailVerification: true,

    // NIST 800-63B guidance: require length, don't require arbitrary
    // complexity rules (no forced special characters, etc.) — those rules
    // tend to push users toward predictable patterns like "Passw0rd!".
    minPasswordLength: 12,
    maxPasswordLength: 128,

    // Called when a user requests a password reset.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        template: "reset-password",
        props: { url },
      });
    },
  },

  // Called by Better Auth automatically after sign-up (and when the user
  // clicks "resend verification email"). `url` is a pre-signed link that
  // verifies the account when visited.
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        template: "verify-email",
        props: { url },
      });
    },
  },

  session: {
    // "Sliding" session: expires 7 days after the LAST activity, not 7 days
    // after login. `updateAge` controls how often we bother re-writing the
    // expiry — we only touch the DB row if the session is more than 24h old,
    // to avoid writing to the database on literally every single request.
    expiresIn: 60 * 60 * 24 * 7, // 7 days, in seconds
    updateAge: 60 * 60 * 24, // 24 hours, in seconds

    cookieCache: {
      // Better Auth can cache "yes, this session is valid" in a short-lived,
      // signed cookie so that most requests don't need a DB round-trip just
      // to check auth. 5 minutes is a reasonable trade-off between DB load
      // and "how fast does a revoked session actually stop working."
      enabled: true,
      maxAge: 60 * 5, // 5 minutes, in seconds
    },
  },

  rateLimit: {
    // Basic brute-force protection on auth endpoints (sign-in, sign-up,
    // forgot-password). 10 requests per 60 seconds, per IP.
    enabled: true,
    window: 60,
    max: 10,
  },
});
