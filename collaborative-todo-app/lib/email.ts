// A thin wrapper around the Resend SDK. Centralizing email-sending here
// means: (1) every call site doesn't need to re-import/configure Resend,
// and (2) if we ever swap email providers, this is the ONLY file that
// needs to change.

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

type SendEmailInput = {
  to: string
  subject: string
  // "template" selects which React Email template to render. Keeping this
  // as a string key (rather than passing JSX directly) keeps call sites
  // simple and avoids importing React Email components everywhere.
  template: 'verify-email' | 'reset-password' | 'invite'
  props: Record<string, unknown>
}

/**
 * Sends a transactional email. Deliberately does NOT throw on failure —
 * callers (see lib/auth.ts, actions/invitations.ts) decide for themselves
 * how to degrade gracefully (e.g. "invite saved, but email failed — share
 * the link manually," per TDD §9 availability table).
 *
 * Returns { success: boolean } so callers can check and show a warning
 * without needing a try/catch at every call site.
 */
export async function sendEmail({ to, subject, template, props }: SendEmailInput) {
  try {
    await resend.emails.send({
      from: 'Kanban App <notifications@ZekiAhmed.dev>',
      to,
      subject,
      // In a real project, `react:` would point at an actual React Email
      // component keyed by `template`. Left generic here since template
      // rendering isn't the focus of this codebase.
      html: renderEmailHtml(template, props),
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { success: false }
  }
}

// Placeholder renderer — swap this out for real React Email templates.
function renderEmailHtml(template: string, props: Record<string, unknown>): string {
  const url = typeof props.url === 'string' ? props.url : '#'
  return `<p>Click <a href="${url}">here</a> to continue (${template}).</p>`
}