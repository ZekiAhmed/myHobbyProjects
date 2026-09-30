/**
 * @fileoverview Public Landing Page (Server Component)
 *
 * Route: / — the public root of the site. The dashboard lives at /boards.
 *
 * Section inventory (top → bottom):
 *   hero (session-branched CTA + CSS mini-board) → how it works →
 *   features (#features) → pricing (#pricing, live price from the
 *   settings row) → FAQ → final CTA
 *
 * Uses getOptionalSession() so the CTA branches on auth state:
 * - Signed out → "Get started" (sign up)
 * - Signed in → "Go to dashboard" (/boards)
 *
 * The Pro price is read server-side from the same singleton row the
 * admin edits at /admin — getPricingSettings() returns bank details
 * too, but only price/currency ever reach this render (bank details
 * belong to /upgrade, behind the session).
 */

import Link from 'next/link'
import { getOptionalSession } from '@/lib/session'
import { getPricingSettings } from '@/lib/pricing-settings'
import { Button } from '@/components/ui/button'

const FEATURES = [
  {
    title: 'Boards for every project',
    description:
      'Create a Kanban board per project and organize work into columns that match how your team actually ships.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="5" height="16" rx="1" />
        <rect x="9.5" y="4" width="5" height="11" rx="1" />
        <rect x="16" y="4" width="5" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Real-time collaboration',
    description:
      'Invite your teammates and watch cards move as everyone works — no refresh, no merge conflicts.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.7-3 2.9-4.5 5.5-4.5s4.8 1.5 5.5 4.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.5 14.5c2.3.3 4 1.7 4.5 4.5" />
      </svg>
    ),
  },
  {
    title: 'Invite links that just work',
    description:
      'Share a single link and collaborators are in. Roles and permissions keep the right people in control.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
      </svg>
    ),
  },
  {
    title: 'Comments & activity log',
    description:
      'Discuss work where the work lives. Every move, comment, and change is logged on the board for anyone to catch up on.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V6Z" />
      </svg>
    ),
  },
  {
    title: 'Notifications that find you',
    description:
      'Assignments and mentions land in your inbox and your bell — nothing slips through because someone forgot to ping the group.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    ),
  },
  {
    title: 'Drag, drop, tag, done',
    description:
      'Drag cards across columns, tag them, quick-complete with one click. Optimistic updates keep every move instant.',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M4 7h9M4 12h6M4 17h9" />
        <path d="m15 15 2.5 2.5L22 13" />
      </svg>
    ),
  },
] as const

const STEPS = [
  {
    title: 'Create a board',
    description:
      'Spin up a Kanban board per project in seconds — To Do, In Progress, Done, ready to fill.',
  },
  {
    title: 'Invite your team',
    description:
      'Share one invite link. Teammates join with the right role and see the board instantly.',
  },
  {
    title: 'Ship together',
    description:
      'Drag cards, comment, get notified. Everyone sees the same board move in real time.',
  },
] as const

const FAQS = [
  {
    question: 'Is it free?',
    answer:
      'Yes. Unlimited personal boards with full features — columns, drag-and-drop, tags, comments — free forever. You only pay when you want to invite teammates to your boards.',
  },
  {
    question: 'How does payment work?',
    answer:
      'No cards. Transfer the listed price to our bank account, upload a photo of your receipt in the app, and an admin activates Pro within 24 hours.',
  },
  {
    question: 'Does my team need to pay too?',
    answer:
      'No. One subscription covers every board you own — the people you invite join and use those boards at no cost.',
  },
  {
    question: 'What happens if I stop renewing?',
    answer:
      'Boards with members become read-only at expiry: nothing is deleted, your team keeps seeing everything, and renewing restores editing. Your personal boards stay fully editable either way.',
  },
] as const

/**
 * Decorative product preview — the signature Kanban column built from
 * DESIGN.md tokens (Slate/Sky/Mint washes, ring-bordered cards, pill
 * badges). aria-hidden: it repeats the headline's meaning.
 */
const BOARD_PREVIEW_COLUMNS = [
  {
    title: 'To Do',
    count: '3',
    className: 'bg-[#f1f5f9] border-[#e2e8f0]',
    cards: [
      { title: 'Draft launch checklist', badge: 'urgent' as const },
      { title: 'Review pricing copy', badge: null },
    ],
  },
  {
    title: 'In Progress',
    count: '2',
    className: 'bg-[#eff6ff] border-[#bfdbfe]',
    cards: [
      { title: 'Ship invite flow', badge: 'tag' as const },
      { title: 'Write release notes', badge: null },
    ],
  },
  {
    title: 'Done',
    count: '4',
    className: 'bg-[#f0fdf4] border-[#bbf7d0]',
    cards: [{ title: 'Set up the board', badge: 'done' as const }],
  },
] as const

function BoardPreview() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full grid-cols-3 gap-2 md:gap-3"
    >
      {BOARD_PREVIEW_COLUMNS.map((column) => (
        <div
          key={column.title}
          className={`rounded-lg border p-2 ${column.className}`}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-foreground">
              {column.title}
            </span>
            <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {column.count}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {column.cards.map((card) => (
              <div
                key={card.title}
                className="rounded-md bg-background p-2.5 ring-1 ring-foreground/10"
              >
                <p className="text-xs font-medium text-foreground">
                  {card.title}
                </p>
                {card.badge === 'urgent' && (
                  <span className="mt-2 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                    Urgent
                  </span>
                )}
                {card.badge === 'tag' && (
                  <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    feature
                  </span>
                )}
                {card.badge === 'done' && (
                  <span className="mt-2 inline-block text-[11px] font-semibold text-[#16a34a]">
                    ✓ Done
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function LandingPage() {
  const [session, settings] = await Promise.all([
    getOptionalSession(),
    getPricingSettings(),
  ])

  const authCta = session ? (
    <Button size="lg" render={<Link href="/boards" />} nativeButton={false}>
      Go to dashboard
    </Button>
  ) : (
    <>
      <Button size="lg" render={<Link href="/sign-up" />} nativeButton={false}>
        Get started
      </Button>
      <Button
        variant="outline"
        size="lg"
        render={<Link href="/sign-in" />}
        nativeButton={false}
      >
        Sign in
      </Button>
    </>
  )

  return (
    <div className="container mx-auto px-4 md:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-16 md:py-24 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6 text-center lg:text-left">
          <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Plan, track, and ship together
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Kanban is a collaborative todo board for small teams. Organize
            tasks, see progress at a glance, and get work across the finish
            line.
          </p>
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            {authCta}
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <BoardPreview />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground">
            From empty page to moving cards in three steps.
          </p>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl bg-background p-6 ring-1 ring-foreground/10"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-foreground/10">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Everything a small team needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            No configuration marathon — the defaults are the workflow.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-background p-6 ring-1 ring-foreground/10"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-foreground/10 [&_svg]:size-5">
                {feature.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Simple, honest pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free. Pay only when your team joins.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
          {/* Free */}
          <div className="flex flex-col rounded-xl bg-background p-6 ring-1 ring-foreground/10">
            <h3 className="text-base font-semibold text-foreground">Free</h3>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">0</span>
              <span className="text-sm text-muted-foreground">forever</span>
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li>✓ Unlimited personal boards</li>
              <li>✓ Full board features — columns, drag-and-drop, tags</li>
              <li>✓ Comments, activity log, notifications</li>
              <li className="text-muted-foreground/70">
                ✗ Inviting teammates — Pro only
              </li>
            </ul>
            <div className="mt-6 pt-1">
              <Button
                variant="outline"
                render={
                  <Link href={session ? '/boards' : '/sign-up'} />
                }
                nativeButton={false}
                className="w-full"
              >
                {session ? 'Go to dashboard' : 'Get started'}
              </Button>
            </div>
          </div>

          {/* Pro */}
          <div className="flex flex-col rounded-xl bg-background p-6 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Pro</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                For teams
              </span>
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-foreground">
                {settings.price} {settings.currency}
              </span>
              <span className="text-sm text-muted-foreground">/ month</span>
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li>✓ Everything in Free</li>
              <li>✓ Invite Members to any board you own</li>
              <li>✓ One subscription covers all your boards</li>
              <li>✓ Members join and use your boards free</li>
            </ul>
            <div className="mt-6 pt-1">
              <Button
                render={
                  <Link href={session ? '/upgrade' : '/sign-up'} />
                }
                nativeButton={false}
                className="w-full"
              >
                {session ? 'Get Pro' : 'Get started'}
              </Button>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-3xl text-center text-xs text-muted-foreground">
          Paid by bank transfer — upload your receipt and an admin activates
          Pro within 24 hours. No bank details are shown here; they live
          inside the app once you subscribe.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Frequently asked questions
          </h2>
        </div>
        <dl className="mx-auto mt-10 flex max-w-3xl flex-col gap-8">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <dt className="text-base font-semibold text-foreground">
                {faq.question}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Final CTA */}
      <section className="pb-20 pt-4 md:pb-24">
        <div className="rounded-xl bg-background p-10 text-center ring-1 ring-foreground/10">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Ready to ship together?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Create your first board in seconds — free for you and your
            personal projects.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            {authCta}
          </div>
        </div>
      </section>
    </div>
  )
}
