import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'
import { sendVerificationEmail, sendPasswordResetEmail } from '@/lib/email'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    sendVerificationEmail: async ({ user, token }: { user: { email: string }; token: string }) => {
      await sendVerificationEmail(user.email, token)
    },
    sendResetPassword: async ({ user, token }: { user: { email: string }; token: string }) => {
      await sendPasswordResetEmail(user.email, token)
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!],
})

export type Session = typeof auth.$Infer.Session
