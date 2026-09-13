import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendVerificationEmail(
  email: string,
  token: string
) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`

  await resend.emails.send({
    from: 'Kanban <onboarding@resend.dev>',
    to: email,
    subject: 'Verify your email address',
    html: `
      <h1>Welcome to Kanban!</h1>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link will expire in 24 hours.</p>
    `,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

  await resend.emails.send({
    from: 'Kanban <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your password',
    html: `
      <h1>Password Reset Request</h1>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  })
}
