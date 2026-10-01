/**
 * @fileoverview Public Landing Page (Server Component)
 *
 * Route: / — the public root of the site. The dashboard lives at /boards.
 *
 * Section inventory (top → bottom), each pair separated by a luminous
 * band rule:
 *   hero (session-branched CTA + live board preview) → how it works →
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
 *
 * The board preview (hero-board.tsx) is a client component: its
 * mono sync readout counts the product's real 8-second refetch
 * cadence and demo cards glide on each tick. Decorative, aria-hidden;
 * this page itself never polls.
 */

import Link from 'next/link'
import { getOptionalSession } from '@/lib/session'
import { getPricingSettings } from '@/lib/pricing-settings'
import { Button } from '@/components/ui/button'
import { HeroBoard } from './hero-board'

const FEATURES = [
  {
    title: 'Boards for every project',
    description:
      'Create a Kanify board per project and organize work into columns that match how your team actually ships.',
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
      'Spin up a Kanify board per project in seconds — To Do, In Progress, Done, ready to fill.',
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

/** Woven band rule — the divider between sections. */
function Band() {
  return <div className="band" aria-hidden="true" />
}

export default async function LandingPage() {
  const [session, settings] = await Promise.all([
    getOptionalSession(),
    getPricingSettings(),
  ])

  const authCta = session ? (
    <Button
      size="lg"
      render={<Link href="/boards" />}
      nativeButton={false}
      className="h-11 px-6 text-[15px]"
    >
      Go to dashboard
    </Button>
  ) : (
    <>
      <Button
        size="lg"
        render={<Link href="/sign-up" />}
        nativeButton={false}
        className="h-11 px-6 text-[15px]"
      >
        Get started
      </Button>
      <Button
        variant="outline"
        size="lg"
        render={<Link href="/sign-in" />}
        nativeButton={false}
        className="h-11 px-6 text-[15px]"
      >
        Sign in
      </Button>
    </>
  )

  return (
    <div>
      {/* Hero */}
      <section className="flex min-h-[calc(100svh-6rem)] flex-col justify-center px-4 pt-14 pb-12 md:px-6 md:pt-16">
        <div className="hero-in mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <p className="mono text-[11px] tracking-[0.2em] text-zinc-400 uppercase md:text-xs">
            Collaborative todo app for small teams
          </p>
          <h1 className="mt-6 max-w-[15ch] text-[clamp(2.5rem,6.5vw,5.25rem)] leading-[1.02] font-extrabold tracking-[-0.035em] text-foreground">
            Plan, track, and ship together
          </h1>
          <p className="mt-5 max-w-[54ch] text-base leading-relaxed text-muted-foreground md:text-lg">
            Kanify is a collaborative todo board for small teams. Organize
            tasks, see progress at a glance, and get work across the finish
            line.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {authCta}
          </div>
          <div className="mt-12 w-full max-w-5xl text-left md:mt-16">
            <HeroBoard />
          </div>
        </div>
      </section>

      <Band />

      {/* How it works — numbered climbing courses */}
      <section id="how-it-works" className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground">
              From empty page to moving cards in three steps.
            </p>
          </div>
          <ol className="mt-12 border-b border-[var(--border)]">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={`reveal flex flex-col gap-3 border-t border-[var(--border)] py-8 md:flex-row md:items-baseline md:gap-10 ${
                  index === 1 ? 'md:ml-10' : index === 2 ? 'md:ml-20' : ''
                }`}
              >
                <span className="mono shrink-0 text-4xl leading-none font-light tabular-nums text-foreground/40 md:text-6xl">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground md:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-[62ch] leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Band />

      {/* Features — cells of cloth on the weave grid */}
      <section id="features" className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Everything a small team needs
            </h2>
            <p className="mt-4 text-muted-foreground">
              No configuration marathon — the defaults are the workflow.
            </p>
          </div>
          <div className="reveal mt-12 grid border-t border-l border-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group border-r border-b border-[var(--border)] p-6 transition-colors hover:bg-white/[0.025] md:p-7"
              >
                <span className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-[var(--glow)] [&_svg]:size-5">
                  {feature.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Band />

      {/* Pricing */}
      <section id="pricing" className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Simple, honest pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Pay only when your team joins.
            </p>
          </div>

          <div className="reveal mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-7">
              <h3 className="text-base font-semibold text-foreground">Free</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="mono text-5xl leading-none font-medium tabular-nums text-foreground">
                  0
                </span>
                <span className="text-sm text-muted-foreground">forever</span>
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-muted-foreground">
                <li>✓ Unlimited personal boards</li>
                <li>✓ Full board features — columns, drag-and-drop, tags</li>
                <li>✓ Comments, activity log, notifications</li>
                <li className="text-muted-foreground/80">
                  ✗ Inviting teammates — Pro only
                </li>
              </ul>
              <div className="mt-auto pt-8">
                <Button
                  variant="outline"
                  render={<Link href={session ? '/boards' : '/sign-up'} />}
                  nativeButton={false}
                  className="w-full"
                >
                  {session ? 'Go to dashboard' : 'Get started'}
                </Button>
              </div>
            </div>

            {/* Pro */}
            <div className="flex flex-col rounded-xl border border-[var(--glow)]/25 bg-[var(--card)] p-7">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">
                  Pro
                </h3>
                <span className="mono rounded-full border border-[var(--glow)]/30 bg-[var(--glow)]/10 px-2 py-0.5 text-[10px] tracking-[0.1em] text-[var(--glow)] uppercase">
                  For teams
                </span>
              </div>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="mono text-5xl leading-none font-medium tabular-nums text-foreground">
                  {settings.price} {settings.currency}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-muted-foreground">
                <li>✓ Everything in Free</li>
                <li>✓ Invite Members to any board you own</li>
                <li>✓ One subscription covers all your boards</li>
                <li>✓ Members join and use your boards free</li>
              </ul>
              <div className="mt-auto pt-8">
                <Button
                  render={<Link href={session ? '/upgrade' : '/sign-up'} />}
                  nativeButton={false}
                  className="w-full"
                >
                  {session ? 'Get Pro' : 'Get started'}
                </Button>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-4xl text-center text-xs leading-relaxed text-muted-foreground">
            Paid by bank transfer — upload your receipt and an admin activates
            Pro within 24 hours. No bank details are shown here; they live
            inside the app once you subscribe.
          </p>
        </div>
      </section>

      <Band />

      {/* FAQ */}
      <section id="faq" className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="reveal max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Frequently asked questions
            </h2>
          </div>
          <dl className="reveal mt-10 border-t border-[var(--border)]">
            {FAQS.map((faq) => (
              <div
                key={faq.question}
                className="grid gap-2 border-b border-[var(--border)] py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-10"
              >
                <dt className="text-base font-semibold text-foreground md:text-lg">
                  {faq.question}
                </dt>
                <dd className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Band />

      {/* Final CTA */}
      <section className="px-4 pt-4 pb-24 md:px-6">
        <div className="reveal mx-auto max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--card)] px-6 py-14 text-center md:px-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Ready to ship together?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Create your first board in seconds — free for you and your
            personal projects.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {authCta}
          </div>
        </div>
      </section>
    </div>
  )
}
