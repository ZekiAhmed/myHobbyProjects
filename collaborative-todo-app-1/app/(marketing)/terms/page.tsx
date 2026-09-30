/**
 * @fileoverview Terms page (Server Component)
 *
 * The second Legal-column destination (impeccable critique P1). Every
 * payment and expiry promise here is copied from the landing FAQ and
 * lib/subscription.ts behavior: read-only at expiry, nothing deleted,
 * renewal restores editing, personal boards unaffected. No company
 * entity is invented; contact is the same real mailbox the app sends
 * email from (lib/email.ts).
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms — Kanify',
  description:
    'The terms of using Kanify: your account, your content, how Free and Pro work, and what happens at expiry.',
}

const SECTIONS = [
  {
    title: 'The service',
    paragraphs: [
      'Kanify is a collaborative todo board for small teams. It is free for personal boards, with an optional Pro subscription for boards with invited members.',
    ],
  },
  {
    title: 'Your account',
    paragraphs: [
      'Provide accurate information and keep your credentials to yourself. You are responsible for what happens under your account. Do not attempt to access boards you have not been invited to.',
    ],
  },
  {
    title: 'Your content',
    paragraphs: [
      'You keep ownership of the boards, todos, and comments you create. Only upload material you have the right to share, and make sure a payment receipt you upload is a genuine record of your own transfer.',
    ],
  },
  {
    title: 'Free and Pro',
    paragraphs: [
      'Free means unlimited personal boards with full features, forever. Pro is the price listed on the pricing page: transfer it to our bank account, upload a photo of your receipt, and an administrator activates Pro within 24 hours. One subscription covers every board you own; the people you invite join those boards at no cost.',
    ],
  },
  {
    title: 'If you stop renewing',
    paragraphs: [
      'Boards with members become read-only at expiry. Nothing is deleted, your team keeps seeing everything, and renewing restores editing. Your personal boards stay fully editable either way.',
    ],
  },
  {
    title: 'Changes and availability',
    paragraphs: [
      'Kanify is provided as is. Features may change or be retired, and the service may be unavailable from time to time. If these terms change, the updated version lives on this page; continuing to use Kanify means you accept it.',
    ],
  },
] as const

export default function TermsPage() {
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
      <h1 className="mt-6 text-3xl font-bold text-foreground">Terms</h1>
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
