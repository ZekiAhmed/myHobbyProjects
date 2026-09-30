# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — The Team Coordinator.** On a small-to-mid knowledge-work team (3–15 people). Frustrated by the overhead of Jira/Asana for lightweight coordination, and underserved by personal todo apps that were never built for sharing. Wants to spin up a shared board in seconds rather than configure a project-management system. Works in a modern desktop browser and expects the UI to feel fast.

**Secondary — The Team Member.** Assigned work by a coordinator or self-assigns from a shared pool. Needs to see what is in progress, mark things done, and know what teammates are working on. Does not want to manage the board — only use it.

**Confirmed market:** Ethiopian teams, English-only interface.

## Product Purpose

A lightweight, shared Kanban todo app: a board all teammates can work on together, with just enough structure (priorities, due dates, tags, assignments, comments, activity) to coordinate a team — and nothing more.

Success is defined by the PRD's metrics: a new team creates a board and invites everyone in under 2 minutes; todo operations (complete, drag-and-drop) feel instant with optimistic UI; all members see teammates' changes within 10 seconds without a manual refresh; 99.9% monthly uptime, because this is a daily-use work tool.

## Positioning

The gap between heavyweight project-management suites and personal todo apps: *"we just need a shared board we can all work on together."*

The mechanism a neighboring product could not truthfully copy is **deliberate subtraction** — a fixed three-column board, exactly one owner, zero configuration surface, and a feature list that refuses custom workflows, sub-tasks, and integrations. Jira and Asana cannot ship "nothing more" without dismantling the configurability their customers bought them for.

## Operating Context

- **Billing:** Free vs Pro. Free covers unlimited personal boards; the landing page states *"Inviting teammates — Pro only."* Pro is paid by **bank transfer in ETB** — no cards. The subscriber transfers the listed price to the product's bank account, uploads a photo of the receipt in-app, and an **Administrator** activates Pro within 24 hours. Bank details live behind the session at `/upgrade`; only price and currency reach the public page.
- **Sync model:** near-real-time by polling — board and notifications refetch every 8 seconds; last-write-wins on concurrent reorders is a documented known limitation.
- **Email:** Resend is strictly transactional — verification, password reset, invitation, payment approval/rejection. Every other notification is in-app only.
- **Deployment:** Vercel + Prisma Accelerate + Postgres, Upstash rate limiting.
- **Language:** English only. i18n is explicitly not scoped; flag it if a non-English audience is ever confirmed.
- **Access:** fully auth-gated. No anonymous or public experience; the only unauthenticated surfaces are auth pages, the invite token page, and the marketing root.

## Capabilities and Constraints

**Shipped (MVP):** email+password auth with verification and password reset · board create/rename/delete · dashboard of owned and member boards · token invitations with 48h expiry and all four accept branches · member removal and self-leaving · 3-column Kanban (To Do / In Progress / Done) · todo CRUD with title, description, status, priority, due date, assignee, tags · quick-complete · drag-and-drop within and across columns with optimistic updates · per-board tags (owner manages, members assign) · client-side filters (priority / assignee / tag / due date) · owner-only board settings · account settings (name, password, delete account) · responsive layout (mobile switches to a stacked single-column list, full-screen todo dialog, collapsible filters).

**Specified for post-MVP (designs committed):** todo comments (flat, hard-deleted, oldest-first pagination) · per-board Activity log with fixed taxonomy (ADR-0002) · session enumeration and revocation ("Security" tab) · synchronous personal data export · targeted notifications with an unread bell and 8s polling · Administrator role for payment-receipt approval and admin admission/release.

**Constraints and boundaries:**
- One owner per board; single-owner authorization model. No co-owners, no member admin roles.
- Todos per board stay under ~300 for MVP; soft UI warning at 200.
- No file attachments, no sub-tasks or nested todos, no custom columns or WIP limits, no WebSocket real-time, no third-party integrations, no mobile native app.
- Invitation tokens must be `crypto.randomBytes(32).toString('hex')` (never CUID) and rate-limited via Upstash.

## Brand Commitments

- **Product name: Kanify.** Confirmed by the owner. The `"Kanban"` string still rendered in the header, footer, and metadata is a stale placeholder awaiting replacement with "Kanify".
- English is the product language.
- No logo, wordmark, or other brand asset exists yet — do not invent or imply one.
- The competitive anti-reference is enterprise project-management chrome (Jira/Asana density, configuration-first surfaces). This is a confirmed product stance, not merely a taste preference.

## Evidence on Hand

- `docs/PRD.md` — full requirements, personas, flows, risks, milestones.
- `docs/TRD.md` — technical requirements.
- `CONTEXT.md` — binding domain glossary (Board, Owner, Member, Invitation, Tag, Todo, Assignee, Comment, Activity log, Notification, Administrator, Active session, Data export) with explicit avoided terms.
- `docs/adr/0001-comments-hard-delete.md`, `docs/adr/0002-activity-log-user-feed-not-audit-trail.md` — committed decisions.
- `.impeccable/design.json` — recorded incumbent design system ("The Quiet Control Room").
- `.impeccable/review/*.png` — desktop and mobile screenshots of board, dashboard, auth, settings, invite, todo surfaces.
- `docs/debugging/*.md` — eight resolved-bug write-ups.

**Absences future work must not fabricate:** no logo/brand assets, no customer list, no testimonials, no press, no published benchmarks. Pricing value comes from the live settings row, not from a hardcoded number.

## Product Principles

1. **And nothing more.** Every feature must justify itself against the smallness promise; if it does not help someone scan, act, or coordinate, it does not ship.
2. **Speed is the product.** Adoption under two minutes, zero perceived lag on every mutation, and no manual refresh to see a teammate's move.
3. **One clear authority.** A single owner per board, an explicit Member role, and an Administrator role that is independent of board membership — authorization stays legible.
4. **Collaboration self-heals.** Concurrent edits converge without user intervention; known races are documented and tolerated rather than over-engineered.
5. **Honest, low-friction monetization.** No card rails the market doesn't use: transparent bank transfer, in-app receipt, human approval inside 24 hours, bank details never public.
