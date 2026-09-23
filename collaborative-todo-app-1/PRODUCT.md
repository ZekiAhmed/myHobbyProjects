# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: **The Team Coordinator** on a small-to-mid knowledge-work team (3–15 people) who wants a shared task board in seconds without the overhead of Jira/Asana, working in a modern desktop browser and expecting fast, responsive UI.

Secondary: **The Team Member** who takes assignments from a shared pool, sees what's in progress, marks work done, and tracks teammates — and does not want to manage the board.

## Product Purpose

A lightweight, shared Kanban todo app: shared boards with near-real-time sync and just enough structure (priorities, due dates, tags, assignments) to coordinate a team — and nothing more.

Success means: a new team creates a board and invites everyone in under 2 minutes; todo operations feel instant (optimistic UI, 0ms perceived lag); all members see teammates' changes within 10 seconds without a manual refresh; 99.9% monthly uptime (this is a daily-use work tool).

## Positioning

The gap between heavyweight project management software and personal todo apps: *"we just need a shared board we can all work on together."* A neighboring product could not truthfully copy this combination — single-owner boards with token email invites, fractional-index drag ordering, 8-second poll sync, and deliberately no configuration surface (no custom columns, no WIP limits, no roles beyond Owner/Member).

## Operating Context

- Modern desktop browsers are the primary scene (React 19 + dnd-kit); mobile web uses a responsive stacked single-column view — there is no native app.
- Email is the transactional channel only (verification, password reset, invitations via Resend); no marketing or in-app email channel.
- Fully auth-gated: no anonymous, guest, or public experience; `/` is the auth-gated dashboard (no public marketing landing page).
- Deployment target: Vercel + Prisma Accelerate + Postgres + Upstash rate limiting.
- Core workflows: sign-up/verify/sign-in/reset; invite accept (new user, signed-out existing, already signed in, invalid/expired); dashboard of owned/member boards; Kanban board (3 columns, side-panel CRUD, drag-and-drop, filters); board settings (owner); account settings.
- Collaboration model: last-write-wins on concurrent edits, self-healed by the 8s poll — a documented known limitation until WebSocket (post-MVP).

## Capabilities and Constraints

**MVP (must have):** email+password auth with verification and reset; board create/rename/delete; dashboard of owned + member boards; email invite via 48h token link with all accept branches; member remove (owner) and leave (member); 3-column Kanban (To Do / In Progress / Done); todo CRUD in a side panel with title, description, status, priority (Low/Medium/High/Urgent), due date, assignee, tags; quick-complete; drag reorder within and across columns (optimistic, fractional index); per-board tags (owner manages, members assign); client-side filters (priority/assignee/tag/due date); board settings page; account settings (name, password, delete account).

**Specified post-MVP (design done, not built):** todo comments (flat, hard-delete, paginated oldest-first); per-board Activity log (high-signal events only, ADR-0002); Security tab (session enumeration/revoke); data export `GET /api/me/export`; targeted in-app notifications (assignee + commenters) with bell + unread count, 8s poll.

**Out of scope:** file attachments, sub-tasks/nested todos, WebSocket real-time (MVP), multiple board owners/admin roles, mobile native app, public/guest access, third-party integrations, custom Kanban columns/WIP limits, i18n, public marketing landing page.

**Durable product facts:**

- Teams are 3–15 members; todos per board stay under ~300 (soft warning at 200).
- Single Owner per Board; Owner vs Member capability split is fixed (see PRD table).
- DONE todos: collapse the Done column after 10 items with a "View all" expand (confirmed; PRD open question #1 resolved).
- Todos assigned to a removed/deleted member are unassigned via `SetNull` (schema-enforced; PRD open question #2 resolved).
- Invite tokens must be `crypto.randomBytes(32).toString('hex')` — never `cuid()`.
- Domain vocabulary is fixed by the `CONTEXT.md` glossary (Board, Owner, Member, Invitation, Tag, Todo, Assignee, Comment, Activity log, Notification, …); avoid its banned synonyms.
- Post-MVP feature specs live in `.scratch/post-mvp-features/` and `docs/adr/`.

**Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind CSS 4 + shadcn/ui, TanStack Query, Prisma 7 + PostgreSQL, Better Auth, Resend, dnd-kit, Upstash, Vitest (existing codebase — not a greenfield choice).

## Evidence on Hand

- `docs/PRD.md` — full PRD (goals, personas, features, flows, risks, milestones).
- `docs/TRD.md` — technical requirements.
- `CONTEXT.md` — domain glossary with preferred/avoided terms.
- `docs/adr/0001-comments-hard-delete.md`, `docs/adr/0002-activity-log-user-feed-not-audit-trail.md`.
- `docs/agents/` — issue tracker, triage labels, domain-doc consumption rules.
- `prisma/schema.prisma` + migrations — implemented data model.
- Working app code (`app/`, `components/`, `actions/`, `lib/`) with passing tests (`lib/__tests__/`).
- `.scratch/post-mvp-features/` — specified future features.

**Absences future work must not fabricate:** no real customers, testimonials, case studies, press, benchmarks, pricing, or licensing; no brand assets (logo, wordmark, voice guide) beyond the descriptive title "Collaborative Kanban Todo App"; no DESIGN.md.

## Product Principles

1. **Just enough structure** — every capability must earn its place against the promise "and nothing more"; resist feature gravity toward project-management suites.
2. **Instant is the baseline** — interactions feel immediate (optimistic UI with rollback); perceived lag is a defect, not a tradeoff.
3. **Authorization stays simple** — single Owner per Board, binary Owner/Member split; do not invent roles or admin layers.
4. **Design for small teams** — optimize for 3–15 people and <300 todos per board, not enterprise scale.
5. **Collaboration is the product** — sync, invites, assignment, and shared visibility outrank personal-productivity features.

## Accessibility & Inclusion

**Undecided (explicit open decision, 2026-09-23).** No accessibility standard (e.g. WCAG level) has been chosen for this product. Do not assume one; surface the choice before UI work that would commit to a standard.
