/**
 * @fileoverview Privacy page (Server Component)
 *
 * The landing footer's Legal column needs a real destination, and the
 * marketing surface had zero trust infrastructure at the money moment
 * (impeccable critique P1). Everything stated here is checked against
 * shipped code: receipt bytes are pruned 30 days after the decision
 * (lib/receipt-retention.ts), board deletion is the Danger Zone in
 * components/settings/BoardSettingsClient.tsx, and there are no
 * analytics packages in package.json. Account removal is operator-
 * handled by email (actions/account.ts is TRD-only today), so the
 * promise is a mailto, not a self-serve button.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy — Kanify',
  description:
    'What Kanify collects, who can see it, how payment receipts are handled, and how to get your account removed.',
}

const SECTIONS = [
  {
    title: 'What Kanify collects',
    paragraphs: [
      'Your account: your name, email address, and a hashed password. Your boards: todo titles and descriptions, columns, priorities, due dates, assignees, tags, comments, the activity log, and notifications. The email addresses you invite to your boards.',
    ],
  },
  {
    title: 'Payments',
    paragraphs: [
      'Kanify never sees card numbers, because payment happens as a bank transfer outside the app. You upload a photo of your receipt inside the app so an administrator can confirm the transfer. Receipt images are deleted 30 days after the decision; the billing record (amount, reference, timestamps, outcome) is kept as an audit trail. Bank details are shown inside the app and never on public pages.',
    ],
  },
  {
    title: 'Email',
    paragraphs: [
      'We send account verification, invitations, and product notifications by email through Resend, our email provider. We never sell your address.',
    ],
  },
  {
    title: 'Who can see your data',
    paragraphs: [
      'The members of a board see that board: everything on it is shared with them by design. The administrator can review payment receipts and manage accounts. Kanify runs no advertising or analytics trackers.',
    ],
  },
  {
    title: 'Deleting content',
    paragraphs: [
      'Board owners can permanently delete a board and all of its data from board settings. You can edit or delete your own comments and todos at any time.',
    ],
  },
  {
    title: 'Removing your account',
    paragraphs: [
      'Email onboarding@ZekiAhmed.dev and we will delete your account and the boards you own.',
    ],
  },
] as const

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16 md:px-6 md:py-24">
      <p className="text-sm">
        <Link
          href="/"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to Kanify
        </Link>
      </p>
      <h1 className="mt-6 text-3xl font-bold text-foreground">Privacy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated September 2026
      </p>
      <div className="mt-10 flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-foreground">
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <section>
          <h2 className="text-base font-semibold text-foreground">
            Questions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Email onboarding@ZekiAhmed.dev and a human will answer.
          </p>
        </section>
      </div>
    </div>
  )
}
