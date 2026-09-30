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
 * - Signed out → "Create a free board" (sign up)
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
    title: 'Three columns, fixed',
    description:
      'To Do, In Progress, Done. That is the whole workflow. No custom columns and no workflow builder to set up first.',
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
    title: 'Updates in seconds',
    description:
      'Invite your teammates and watch cards move as everyone works. The board refreshes within seconds, so nobody has to reload.',
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
    title: 'Exactly one owner',
    description:
      "One owner manages each board's settings, tags, and members. No role matrices and no permissions screens to learn.",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19c.8-3.4 3.6-5.2 7-5.2s6.2 1.8 7 5.2" />
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
      'Assignments land in your in-app bell the moment work is yours. Nothing slips through because someone forgot to ping the group.',
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
      'Spin up a board per project in seconds: To Do, In Progress, Done, ready to fill.',
  },
  {
    title: 'Invite your team',
    description:
      'Share one invite link. Teammates join with the right role and see the board instantly.',
  },
  {
    title: 'Ship together',
    description:
      'Drag cards, comment, get notified. Everyone sees the same board move within seconds.',
  },
] as const

const FAQS = [
  {
    question: 'Is it free?',
    answer:
      'Yes. Unlimited personal boards with full features: columns, drag-and-drop, tags, comments, free forever. You only pay when you want to invite teammates to your boards.',
  },
  {
    question: 'How does payment work?',
    answer:
      'No cards. Transfer the listed price to our bank account, upload a photo of your receipt in the app, and an admin activates Pro within 24 hours.',
  },
  {
    question: 'Does my team need to pay too?',
    answer:
      'No. One subscription covers every board you own; the people you invite join and use those boards at no cost.',
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
 *
 * Honest by construction (impeccable critique P2): the count pill
 * renders cards.length, so it can never contradict the cards (the real
 * board derives its count the same way — KanbanBoard's mobile list uses
 * statusTodos.length), and the geometry mirrors KanbanColumn exactly:
 * w-full columns stacked below md, fixed w-72 columns in a gap-4 row at
 * md+, cropped to this window instead of squeezed into slivers.
 */
const BOARD_PREVIEW_COLUMNS = [
  {
    title: 'To Do',
    className: 'bg-[#f1f5f9] border-[#e2e8f0]',
    cards: [
      { title: 'Draft launch checklist', badge: 'urgent' as const },
      { title: 'Review pricing copy', badge: null },
      { title: 'Prep Friday demo', badge: null },
    ],
  },
  {
    title: 'In Progress',
    className: 'bg-[#eff6ff] border-[#bfdbfe]',
    cards: [
      { title: 'Ship invite flow', badge: 'tag' as const },
      { title: 'Write release notes', badge: null },
    ],
  },
  {
    title: 'Done',
    className: 'bg-[#f0fdf4] border-[#bbf7d0]',
    cards: [
      { title: 'Set up the board', badge: 'done' as const },
      { title: 'Invite the design team', badge: 'done' as const },
      { title: 'Move the backlog over', badge: 'done' as const },
      { title: 'Turn on notifications', badge: 'done' as const },
    ],
  },
] as const

function BoardPreview() {
  return (
    <div aria-hidden="true" className="w-full overflow-hidden">
      <div className="flex flex-col gap-2 md:flex-row md:gap-4">
        {BOARD_PREVIEW_COLUMNS.map((column) => (
          <div
            key={column.title}
            className={`w-full md:w-72 md:shrink-0 rounded-lg border p-2 md:rounded-xl md:p-4 ${column.className}`}
          >
            <div className="mb-2 flex items-center justify-between gap-1 px-1 md:mb-3">
              <span className="text-xs font-semibold text-foreground md:text-sm">
                {column.title}
              </span>
              <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-xs font-medium text-muted-foreground md:px-2">
                {column.cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 md:gap-3">
              {column.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-md bg-background p-2.5 ring-1 ring-foreground/10 md:rounded-lg md:p-4"
                >
                  <p className="text-xs font-medium text-foreground md:text-sm">
                    {card.title}
                  </p>
                  {card.badge === 'urgent' && (
                    <span className="mt-2 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Urgent
                    </span>
                  )}
                  {card.badge === 'tag' && (
                    <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      feature
                    </span>
                  )}
                  {card.badge === 'done' && (
                    <span className="mt-2 inline-block text-xs font-semibold text-[#15803d]">
                      ✓ Done
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function LandingPage() {
  const [session, settings] = await Promise.all([
    getOptionalSession(),
    getPricingSettings(),
  ])

  const authCta = session ? (
    <Button
      size="lg"
      className="bg-blue-600 text-white hover:bg-blue-700"
      render={<Link href="/boards" />}
      nativeButton={false}
    >
      Go to dashboard
    </Button>
  ) : (
    <>
      <Button
        size="lg"
        className="bg-blue-600 text-white hover:bg-blue-700"
        render={<Link href="/sign-up" />}
        nativeButton={false}
      >
        Create a free board
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
      {/* Hero — stance and board side by side at md+; the board fills
          the right half instead of leaving it empty (impeccable
          critique P2), and stays full-width below md */}
      <section className="py-16 md:py-24">
        <div className="md:flex md:items-center md:gap-8 lg:gap-12">
          <div className="md:max-w-sm md:shrink-0 lg:max-w-md xl:max-w-xl">
            <h1 className="text-4xl font-bold text-balance text-foreground md:text-5xl">
              A shared board that refuses to be configured
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Kanify is a collaborative todo board for small teams: three
              fixed columns, exactly one owner, nothing to configure.
              Invite your teammates and everyone works on the same board.
              Updates land within seconds.
            </p>
            <div className="mt-8 flex items-center gap-3">{authCta}</div>
          </div>
          <div className="mt-12 min-w-0 overflow-hidden md:mt-0 md:flex-1">
            <BoardPreview />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 md:scroll-mt-16 py-16 md:py-20">
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

      {/* Features — the argument section: left-aligned, more generous rhythm */}
      <section id="features" className="scroll-mt-24 md:scroll-mt-16 py-20 md:py-28">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Everything a small team needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            No configuration marathon. The defaults are the workflow.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`rounded-xl bg-background p-6 ring-1 ring-foreground/10 ${index === 0 ? 'lg:col-span-2' : ''}`}
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
      <section id="pricing" className="scroll-mt-24 md:scroll-mt-16 py-16 md:py-20">
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
              <li>✓ Full board features: columns, drag-and-drop, tags</li>
              <li>✓ Comments, activity log, notifications</li>
              <li className="text-muted-foreground">
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
                {session ? 'Go to dashboard' : 'Create a free board'}
              </Button>
            </div>
          </div>

          {/* Pro — the one-accent card: Signal Blue carries the paid tier */}
          <div className="flex flex-col rounded-xl bg-background p-6 ring-2 ring-blue-600">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Pro</h3>
              <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-xs font-medium text-blue-700">
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
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
              No cards. Pay by bank transfer with a receipt photo; an admin
              approves it within 24 hours.
            </p>
            <div className="mt-4 pt-1">
              <Button
                className="w-full bg-blue-600 text-white hover:bg-blue-700"
                render={
                  <Link href={session ? '/upgrade' : '/sign-up'} />
                }
                nativeButton={false}
              >
                Get Pro
              </Button>
            </div>
          </div>
        </div>

        {/* Reassurance band — the privacy promise; the mechanism itself
            now sits inside the Pro card, at the click point */}
        <div className="mx-auto mt-6 flex max-w-3xl items-start gap-3 rounded-xl bg-muted px-5 py-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-blue-600"
          >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">
              Bank details stay private inside the app.
            </span>{" "}
            Nothing about your payment appears on this public page.
          </p>
        </div>
      </section>

      {/* FAQ — reading mode: left-aligned like a document */}
      <section id="faq" className="scroll-mt-24 md:scroll-mt-16 py-16 md:py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold text-foreground md:text-3xl">
            Frequently asked questions
          </h2>
        </div>
        <dl className="mt-10 flex max-w-2xl flex-col gap-8">
          {FAQS.map((faq) => (
            <div key={faq.question}>
              <dt className="text-base font-semibold text-foreground">
                {faq.question}
              </dt>
              <dd className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
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
            Create your first board in seconds. Free for you and your
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
