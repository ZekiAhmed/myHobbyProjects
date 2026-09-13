# Collaborative Kanban Todo App — Product Requirements Document (PRD)

## 1. Overview & Problem Statement

Work teams need a lightweight, shared task manager they can adopt instantly — without the overhead of tools like Jira or Asana, and without the limitation of personal todo apps that don't support real collaboration.

**The problem:** Small-to-mid work teams (3–15 people) either over-engineer their task tracking with heavyweight project management software, or under-engineer it with personal todo apps that were never built for sharing. Neither fits the gap of *"we just need a shared board we can all work on together."*

**The solution:** A focused, collaborative Kanban todo app — shared boards with real-time-ish sync, just enough structure (priorities, due dates, tags, assignments) to coordinate a team, and nothing more.

---

## 2. Goals & Success Metrics

| # | Metric | Target |
|---|--------|--------|
| 1 | Onboarding speed | A new team can create a board and invite all members in under 2 minutes |
| 2 | Interaction responsiveness | Todo operations (complete, drag-and-drop reorder) feel instant — optimistic UI, 0ms perceived lag |
| 3 | Collaboration sync | All members see teammates' changes within 10 seconds without a manual refresh |

> **Uptime target:** 99.9% monthly (~43 minutes allowable downtime/month) — this is a daily-use work tool.

---

## 3. Target Users / Personas

### 🧑‍💼 Primary Persona: The Team Coordinator

- Works on a small-to-mid knowledge work team (3–15 people)
- Frustrated by the overhead of Jira/Asana for lightweight coordination needs
- Wants to spin up a shared task board in seconds, not configure a project management system
- Uses a modern desktop browser; expects the UI to feel fast and responsive

### 👤 Secondary Persona: The Team Member

- Assigned tasks by a coordinator or self-assigns from a shared pool
- Needs to see what's in progress, mark things done, and know what teammates are working on
- Doesn't want to manage the board — just wants to use it

---

## 4. Features (MVP, Prioritized)

### ✅ Must Have

| # | Feature | Implementation Pattern |
|---|---------|----------------------|
| 1 | Sign up with email + password | Better Auth `emailAndPassword` plugin |
| 2 | Email verification | Better Auth built-in + Resend |
| 3 | Sign in / Sign out | Better Auth built-in |
| 4 | Forgot password / Reset password | Better Auth built-in + Resend |
| 5 | Create / rename / delete a Board | Server Action + `revalidateTag` + `invalidateQueries` |
| 6 | Dashboard — view all owned + member boards | `prefetchQuery` + `HydrationBoundary` + `useSuspenseQuery` |
| 7 | Invite member by email (token link, 48h expiry) | Custom Invitation model + Resend + Server Action |
| 8 | Accept invite (new user, existing unauthed, already signed in) | `/invite/[token]` semi-public page + `getOptionalSession()` |
| 9 | Remove member from board | Server Action + `revalidateTag` (owner-only) |
| 10 | Leave board (member self-removal) | Server Action + `revalidateTag` |
| 11 | Kanban board — 3 columns: To Do / In Progress / Done | `prefetchQuery` + `HydrationBoundary` + `useSuspenseQuery` |
| 12 | Create / edit / delete a Todo (side panel) | Server Action + `revalidateTag` + `invalidateQueries` |
| 13 | Todo fields: title, description, status, priority, due date, assignee, tags | Part of create/edit Server Action |
| 14 | Quick-complete ✓ button on todo card | `useMutation` + `onMutate` optimistic update + rollback |
| 15 | Drag-and-drop reorder within a column | `useMutation` + `onMutate` optimistic fractional index update + rollback |
| 16 | Drag-and-drop across columns (status change) | `useMutation` + `onMutate` optimistic status + order update + rollback |
| 17 | Assign todo to a team member | Part of create/edit form — Server Action |
| 18 | Priority levels: Low / Medium / High / Urgent | Part of create/edit form — Server Action |
| 19 | Due dates on todos | Part of create/edit form — Server Action |
| 20 | Per-board tags: create / delete / assign to todo | Server Action (owner manages tags; members assign in edit form) |
| 21 | Near-real-time sync for teammates | `useQuery` + `refetchInterval: 8000` + `staleTime: 0` |
| 22 | Filter todos by priority / assignee / tag / due date | Client-side filter state over already-loaded board data |
| 23 | Board Settings page — rename, manage members, manage tags, delete board | Server Actions (owner-only) |
| 24 | Account settings — change name, change password, delete account | Server Actions + Better Auth |

### 🔜 Should Have (Post-MVP)

- Todo comments (paginated feed)
- Activity log per board
- Session enumeration UI ("Security" tab — view and revoke active sessions)
- Data export (`GET /api/me/export`) for GDPR right-to-access
- Notifications + unread counts

### 💡 Could Have (Future)

- WebSocket real-time (replaces polling at scale)
- Virtual list rendering for large columns (`@tanstack/react-virtual`)
- i18n / multi-language support
- Slack / GitHub integration

---

## 5. Out of Scope

| Feature | Reason |
|---------|--------|
| Comments on todos | Post-MVP — adds significant complexity (`useInfiniteQuery`, schema changes) |
| Activity log / audit trail | Post-MVP — needs `AuditLog` model; flag before first post-launch migration |
| File attachments | Post-MVP — requires S3/R2 integration |
| Sub-tasks / nested todos | Not in scope — keeps the data model clean |
| Notifications system | Post-MVP |
| WebSocket real-time | Polling covers MVP needs; WebSocket is a scaling upgrade |
| Multiple board owners / admin roles | Single owner per board — clean authorization model |
| Mobile native app | Web only |
| Public / guest access | Fully auth-gated — no anonymous experience |
| Third-party integrations | Post-MVP |
| Kanban customization (custom columns, WIP limits) | Post-MVP |
| i18n | Not scoped — flag if non-English audience is confirmed |
| Public marketing landing page | `/` is the auth-gated dashboard for now |

---

## 6. User Flows

### Auth Flows

#### Sign Up
```text
/sign-up
  → enter email + password (min 12 chars, strength meter shown)
  → Better Auth creates unverified account
  → Resend sends verification email
  → redirect to /verify-email ("Check your inbox")
  → user clicks link in email
  → account verified
  → redirect to / (dashboard)
```

#### Sign In
```text
/sign-in
  → enter email + password
  → if unverified: show "Please verify your email" + "Resend verification email" link
  → if verified: session created (7-day sliding)
  → redirect to / (dashboard)
    or to ?callbackUrl= destination if redirected from a protected route
```

#### Forgot Password
```text
/sign-in → "Forgot password?"
  → /forgot-password → enter email
  → Resend sends reset link
  → /reset-password?token=... → enter new password
  → redirect to /sign-in
```

#### Sign Out
```text
Any page → click Sign Out
  → session deleted from DB + cookie cleared
  → redirect to /sign-in
```

#### Unauthenticated User Hits Protected Route
```text
proxy.ts detects no session cookie
  → redirect to /sign-in?callbackUrl=<encoded-original-url>
  → after sign-in, redirect back to original destination
```

---

### Invite Flow

```text
Owner on /boards/[id]/settings
  → enters email → clicks "Invite"
  → Server Action: creates Invitation record (token = 32-byte random hex, 48h expiry)
  → Resend sends invite email with link: /invite/[token]

Invitee clicks link → /invite/[token]:

  Branch A — new user (no account):
    → redirect to /sign-up?inviteToken=[token]
    → signs up → verifies email → Invitation consumed → added as Member
    → redirect to /boards/[id]

  Branch B — existing user, not signed in:
    → redirect to /sign-in?inviteToken=[token]
    → signs in → Invitation consumed → added as Member
    → redirect to /boards/[id]

  Branch C — already signed in:
    → Invitation consumed immediately on page load
    → redirect to /boards/[id]

  Branch D — token invalid or expired:
    → error page: "This invite link is invalid or has expired.
       Ask the board owner to send a new one."
```

---

### Dashboard Flow

```text
/ (dashboard)
  → Two sections:
    "Boards I Own" | "Boards I'm a Member of"
  → Each card: board name, member count, open todo count
  → "New Board" → modal → enter name → create → redirect to /boards/[id]
  → Click card → /boards/[id]
```

---

### Kanban Board Flow

```text
/boards/[id]
  → 3 columns: To Do | In Progress | Done
  → Each column: todo cards sorted by fractional index (drag order)
  → Filter bar: priority / assignee / tag / due date
  → "Add Todo" button → side panel (create mode)

Todo card:
  → title, priority badge, due date, assignee avatar, tag chips
  → ✓ quick-complete button → optimistic move to Done
  → click card body → side panel (edit mode)

Drag within column:
  → reorders (updates fractional order key) — optimistic, instant

Drag across column:
  → changes status + reorders in new column — optimistic, instant

Side panel (create):
  → fields: title, description, status, priority, due date, assignee, tags
  → submit → Server Action → panel closes → board updates

Side panel (edit):
  → same fields, pre-populated
  → "Delete Todo" button (bottom, destructive) — member or owner

Near-real-time:
  → board polls /api/boards/[id]/todos every 8 seconds
  → teammate changes appear without manual refresh
```

---

### Board Settings Flow (Owner Only)

```text
/boards/[id]/settings (gear icon — only rendered for Owner)
  → Rename board
  → Tags: create new tag (name + color), delete tag
  → Members: view all, remove a member, invite new member by email
  → Danger zone: "Delete Board" → confirm dialog → deletes board + all todos
    → redirect to /
```

---

### Owner vs. Member UI Differences

| UI Element | Owner | Member |
|------------|:-----:|:------:|
| Settings gear icon | ✅ | ❌ |
| Rename board | ✅ | ❌ |
| Delete board | ✅ | ❌ |
| Invite / remove members | ✅ | ❌ |
| Create / delete tags | ✅ | ❌ |
| Add / edit / delete todos | ✅ | ✅ |
| Assign tags to todos | ✅ | ✅ |
| Drag to reorder / move | ✅ | ✅ |
| Quick-complete ✓ | ✅ | ✅ |
| Leave board | ❌ | ✅ |

---

### Public vs. Protected Routes

| Route | Auth Required | Notes |
|-------|:-------------:|-------|
| `/sign-in` | ❌ | Redirect to `/` if already authed |
| `/sign-up` | ❌ | Redirect to `/` if already authed |
| `/forgot-password` | ❌ | |
| `/reset-password` | ❌ | Token validated server-side |
| `/verify-email` | ❌ | |
| `/invite/[token]` | ❌ Semi-public | Accessible without auth; token preserved through sign-in/sign-up |
| `/` (dashboard) | ✅ | `getRequiredSession()` |
| `/boards/[id]` | ✅ | `getRequiredSession()` + membership check |
| `/boards/[id]/settings` | ✅ | `getRequiredSession()` + owner check |

---

## 7. Risks & Assumptions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Concurrent drag-and-drop conflicts (two members reorder simultaneously) | Medium | Last write wins; 8s poll self-heals. Documented known limitation. WebSocket is post-MVP mitigation |
| Invite token enumeration (CUID is time-based, partially predictable) | High | Token must use `crypto.randomBytes(32).toString('hex')` — not `cuid()`. Rate limiting on `/invite/[token]` via Upstash |
| Resend down during sign-up — user stuck unverified | Medium | "Resend verification email" prompt in UI. Better Auth handles retry flow |
| Polling load at medium scale (125+ DB reads/sec at steady state) | Medium | Prisma Accelerate edge caching reduces Postgres hits significantly |
| >300 todos per board — payload and DOM become unwieldy | Low-Medium | Soft UI warning at 200 todos. `?status=` filter param on API route already supports per-column fetch |

### Assumptions

- Teams are small: 3–15 members per board
- One user can own/be a member of many boards
- Todos per board stay under ~300 for MVP
- Users are on modern browsers (React 19 + dnd-kit requirement)
- 8-second teammate sync lag is acceptable for work team collaboration
- Deployment target is Vercel + Prisma Accelerate + Resend

### Open Questions (Decisions Needed Before Build)

| # | Question | Recommended Default |
|---|----------|---------------------|
| 1 | What happens to DONE todos — always visible or collapsed/archived? | Collapse DONE column after 10 items with "View all" expand |
| 2 | Todos assigned to a removed member — unassign or transfer to owner? | `SetNull` (unassign) — already in schema; confirm this is acceptable |
| 3 | Activity feed (who changed what) — MVP or firmly post-MVP? | Firmly post-MVP — but add `AuditLog` model to schema in first post-launch migration |

---

## 8. Milestones

| Milestone | Scope | Est. Duration |
|-----------|-------|:-------------:|
| **1 — Foundation & Auth** | Repo setup, Better Auth, email verify, password reset, `proxy.ts`, session helpers | ~1.5 weeks |
| **2 — Core Schema + Boards CRUD** | Full Prisma schema, dashboard, board create/rename/delete, TanStack Query wired, Prisma Accelerate live | ~1 week |
| **3 — Invite Flow + Membership** | Invite token flow (all branches), board detail scaffold, member management, Upstash rate limiting | ~1 week |
| **4 — Kanban Board + Todo CRUD** | Full Kanban board, dnd-kit, all todo fields, optimistic mutations, polling, tag management, filters | ~2 weeks |
| **5 — Polish & Pre-Launch Hardening** | Error boundaries, auth/authorization audit, N+1 audit, health check, README, smoke test | ~1 week |

> **Total: ~6.5 weeks (solo builder)**