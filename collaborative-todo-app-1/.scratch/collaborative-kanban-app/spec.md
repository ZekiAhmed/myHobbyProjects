## Problem Statement

Work teams (3–15 people) need a lightweight, shared task manager they can adopt instantly — without the overhead of tools like Jira or Asana, and without the limitation of personal todo apps that don't support real collaboration. Small-to-mid teams either over-engineer their task tracking with heavyweight project management software, or under-engineer it with personal todo apps that were never built for sharing.

## Solution

A focused, collaborative Kanban todo app called "Collaborative Kanban Todo App" — shared boards with real-time-ish sync, just enough structure (priorities, due dates, tags, assignments) to coordinate a team, and nothing more. Built with Next.js 16, React 19, Prisma, PostgreSQL, Better Auth, and Tailwind CSS v4.

## User Stories

### Authentication

1. As a new user, I want to sign up with email + password, so that I can create an account
2. As a new user, I want to verify my email address, so that my account is activated
3. As a registered user, I want to sign in with my email + password, so that I can access my boards
4. As a registered user, I want to sign out, so that my session is terminated
5. As a registered user, I want to reset my password if I forget it, so that I can regain access to my account
6. As an unauthenticated user, I want to be redirected to sign-in when I try to access a protected route, so that I'm prompted to authenticate

### Board Management

7. As a team coordinator, I want to create a new board, so that I can start organizing tasks for my team
8. As a board owner, I want to rename my board, so that I can keep it descriptive
9. As a board owner, I want to delete my board, so that I can remove boards I no longer need
10. As a board owner, I want to transfer ownership to another member, so that I can hand off responsibility when needed
11. As a user, I want to see all boards I own and all boards I'm a member of on my dashboard, so that I can quickly access my work
12. As a user, I want to see board name, member count, and open todo count for each board card, so that I can choose which board to open

### Membership & Invitations

13. As a board owner, I want to invite a member by email, so that they can join my board
14. As a board owner, I want to revoke a pending invitation, so that I can prevent unauthorized access if a token is leaked
15. As a board owner, I want to remove a member from my board, so that I can manage who has access
16. As a board member, I want to leave a board, so that I can stop being notified about it
17. As an invitee, I want to accept an invitation via a token link, so that I can join the board
18. As an invitee with no account, I want to sign up through the invitation flow, so that I can join the board after creating an account
19. As an invitee who is already signed in, I want the invitation to be consumed immediately, so that I don't have to click another link

### Kanban Board

20. As a user, I want to see a Kanban board with three columns (To Do, In Progress, Done), so that I can visualize workflow
21. As a user, I want todos sorted by fractional index within each column, so that drag order is preserved
22. As a user, I want to filter todos by priority, assignee, tag, or due date, so that I can find specific tasks quickly
23. As a user, I want to see near-real-time updates from teammates (within 8 seconds), so that I don't have to manually refresh

### Todo CRUD

24. As a user, I want to create a todo with title, description, status, priority, due date, assignee, and tags, so that I can capture all task details
25. As a user, I want to edit a todo's fields, so that I can keep it up to date
26. As a user, I want to delete a todo, so that I can remove tasks that are no longer relevant
27. As a user, I want to quickly complete a todo with a ✓ button, so that I can mark it done without opening the side panel
28. As a user, I want to drag a todo within a column to reorder it, so that I can prioritize tasks visually
29. As a user, I want to drag a todo across columns to change its status, so that I can move it through the workflow

### Tags

30. As a board owner, I want to create tags with a name and color, so that I can categorize todos
31. As a board owner, I want to delete tags, so that I can remove categories I no longer need
32. As a user, I want to assign tags to todos, so that I can categorize them
33. As a user, I want tags to be scoped per board, so that unrelated teams' tag names don't leak between boards

### Board Settings

34. As a board owner, I want to access a settings page, so that I can manage the board
35. As a board owner, I want to manage members (view, invite, remove), so that I can control access
36. As a board owner, I want to manage tags (create, delete), so that I can maintain categories
37. As a board owner, I want to delete the board with a confirmation dialog, so that I don't accidentally remove it

### UI Feedback

38. As a user, I want to see a toast notification when an invisible action succeeds (invite sent, email verified), so that I know it worked
39. As a user, I want to see a toast notification when any action fails, so that I know something went wrong
40. As a user, I want to see specific error messages for validation errors (e.g., "Tag name already exists"), so that I know how to fix the issue
41. As a user, I want to see inline loading indicators (button spinners) during actions, so that I know the system is working
42. As a user, I want to see a success toast for slow operations (>1 second), so that I get confirmation even if the UI update isn't immediately noticeable

### Responsive Design

43. As a desktop user, I want the full Kanban board with drag-and-drop, so that I can manage tasks efficiently
44. As a mobile user, I want a simplified list view of todos by status, so that I can check my board on a small screen
45. As a mobile user, I want drag-and-drop disabled, so that I don't accidentally reorder tasks with imprecise touch gestures
46. As a mobile user, I want to tap a todo to open a full-screen side panel, so that I can edit tasks on a small screen

### Error Handling

47. As a user, I want to see inline validation errors in forms, so that I know exactly what to fix
48. As a user, I want to see a toast for authorization errors (e.g., "Only the board owner can delete the board"), so that I understand the permission model
49. As a user, I want to see a generic toast with retry for network/server errors, so that I know to try again
50. As a user, I want optimistic updates to roll back on failure, so that I don't see incorrect data

## Implementation Decisions

### Board Naming

- The core entity is called **"Board"** (not "List"). This aligns with Kanban terminology where a "board" contains columns of todos, and avoids confusion with "list" meaning a column.
- Routes: `/boards/[id]`, `/boards/[id]/settings`
- Actions: `createBoard`, `renameBoard`, `deleteBoard`, `transferOwnership`
- Query keys: `boardKeys.all()`, `boardKeys.detail(id)`, `boardKeys.todos(id)`

### Fixed Columns (Enum)

- Columns are **not configurable per board**. Every board has exactly three columns: To Do, In Progress, Done.
- Implemented as a `TodoStatus` enum on the Todo model, not as a separate Column entity.
- Customizable columns are post-MVP. The migration path to configurable columns is clean: create a Column entity, map enum values to default columns, migrate `Todo.status` to `Todo.columnId`.

### Ownership Model

- **Single owner per board** — no co-owners, no admin roles.
- The owner is NOT automatically a BoardMember. Ownership and membership are checked separately in authorization logic.
- **Ownership transfer** is supported: the owner can transfer to any existing member. The old owner loses settings access.
- Owner vs. member UI differences: owner sees settings gear, can rename/delete board, can invite/remove members, can create/delete tags. Member can add/edit/delete todos, assign tags, drag to reorder, quick-complete, and leave the board.

### Invitation Security

- Token generated with `crypto.randomBytes(32).toString('hex')` — 256-bit random, cryptographically secure. Never use `cuid()`.
- 48-hour expiry enforced server-side.
- Rate limiting on `/invite/[token]` via Upstash Redis (30 req / 60s / IP).
- **Invitation revocation** supported: board owner can revoke pending invitations before they're consumed. If the token was already consumed, show "This invitation was already accepted."

### Polling Interval

- **8-second polling** (`refetchInterval: 8000`) for near-real-time teammate sync.
- `staleTime: 0` ensures every poll fetches fresh data.
- Prisma Accelerate edge caching reduces DB hits for repeated identical queries.
- WebSocket is post-MVP for scaling beyond polling limits.

### Fractional Indexing

- Uses the `fractional-indexing` library for drag-and-drop reordering.
- The `order` field on Todo is a sortable string (e.g., "a0", "a0V", "a1").
- No uniqueness check on the `order` field — trust the library's guarantees.
- Concurrent drag conflicts: last write wins; 8-second poll self-heals. Documented known limitation.

### DONE Todo Behavior

- **Collapse DONE column after 10 items** with a "View all completed" expand button.
- Keeps the board focused on active work while preserving access to completed todos.
- Post-MVP: archive feature that moves DONE todos out of the board entirely.

### Todos Assigned to Removed Member

- **`SetNull` (unassign)** — the todo becomes unassigned rather than being deleted or transferred to the owner.
- The owner can filter by "unassigned" and reassign todos intentionally.
- Visual indicator for unassigned todos in the dashboard and board views.

### Error Handling

- **Hybrid approach** — specific for validation/authorization, generic for network/server.
- Server Actions return `{ success: true }` or `{ success: false, type: 'validation'|'authorization'|'server', message: string }`.
- Validation errors: inline error message below the field in forms.
- Authorization errors: toast with specific message (e.g., "Only the board owner can delete the board").
- Network/server errors: generic toast with retry button.

### Tags

- **Per-board** — each board has its own set of tags. Tags don't leak between boards.
- Owner manages tags (create/delete). Members assign tags to todos in the edit form.
- Tag name unique per board (`@@unique([boardId, name])`).

### Optimistic Updates

- **No deduplication** for concurrent actions on the same todo.
- Pattern: update client cache immediately (`onMutate`), send Server Action, on success invalidate both caches, on failure roll back + show error toast.
- Edge case (user drags same todo twice quickly, first fails, second succeeds): rare, self-heals in 8 seconds via polling. Accepted as known limitation.

### UI Feedback

- **Success toasts:** Only for invisible actions (invite sent, email verified) and slow operations (>1 second). Not for visible actions (todo created, board renamed) — the UI update is confirmation enough.
- **Error toasts:** Always show on failure.
- **Loading states:** Inline indicators (button spinners, "Saving…" text in side panel), not toasts.

### Responsive Design

- **Desktop-first with basic mobile usability.**
- Desktop: full Kanban board with drag-and-drop, side panel, all features.
- Mobile: simplified list view of todos by status, no drag-and-drop, tap to open full-screen side panel, quick-complete still works.
- Tailwind CSS v4 breakpoint utilities for responsive layout.

### Two-Cache System

- **Next.js fetch cache** (server-side, CDN) invalidated via `revalidateTag()` in Server Actions.
- **TanStack Query client cache** (browser in-memory) invalidated via `queryClient.invalidateQueries()` after mutations.
- Every mutation must invalidate both caches where relevant.

### Auth Architecture

- **`proxy.ts`** (not `middleware.ts`) — cookie-presence guard, UX-level redirect only. No DB hit.
- **`getRequiredSession()`** — authoritative DB session check. Used in every protected Server Component, Server Action, and Route Handler.
- **Membership check** — inside Route Handlers + Server Actions, after session check. Never assumed from session alone.
- **Ownership check** — for owner-only Server Actions and UI gating.

## Testing Decisions

- Test external behavior, not implementation details.
- Focus on: Server Action success/failure paths, authorization checks (owner vs member vs unauthenticated), optimistic update rollback, polling sync.
- Prior art: the codebase uses standard React Testing Library patterns and Vitest (based on the project setup).
- Key seams for testing:
  - Server Actions (board CRUD, todo CRUD, membership, invitations)
  - Route Handlers (GET /api/boards, GET /api/boards/[id]/todos)
  - Client components (KanbanBoard, TodoCard, FilterBar, SidePanel)
  - Auth flow (sign-up, sign-in, invite consumption)

## Out of Scope

- Todo comments (post-MVP — adds `useInfiniteQuery`, schema changes)
- Activity log / audit trail (post-MVP — needs `AuditLog` model)
- File attachments (post-MVP — requires S3/R2 integration)
- Sub-tasks / nested todos (not in scope — keeps data model clean)
- Notifications system (post-MVP)
- WebSocket real-time (post-MVP — polling covers MVP needs)
- Multiple board owners / admin roles (single owner — clean authorization model)
- Mobile native app (web only)
- Public / guest access (fully auth-gated)
- Third-party integrations (post-MVP)
- Kanban customization — custom columns, WIP limits (post-MVP)
- i18n / multi-language support (not scoped)
- Public marketing landing page (`/` is the auth-gated dashboard)
- Configurable columns per board (post-MVP)
- Global tags shared across boards (per-board for MVP)
- Deduplication for concurrent optimistic updates (rare edge case, self-heals)
- Invitation transfer to owner when member is removed (SetNull for MVP)
- Ownership transfer UI beyond basic flow (post-MVP: ownership transfer request, acceptance)

## Further Notes

- **Total estimated timeline:** ~6.5 weeks (solo builder)
- **Deployment target:** Vercel + Prisma Accelerate + Resend + Neon PostgreSQL
- **Uptime target:** 99.9% monthly (~43 minutes allowable downtime)
- **Known limitations:** Concurrent drag-and-drop conflicts (last write wins, 8s self-heal), 8-second sync lag for teammate changes, DONE column collapse at 10 items (configurable threshold post-MVP)
- **Open questions resolved:** DONE todo behavior (collapse after 10), todos assigned to removed member (SetNull), activity feed (firmly post-MVP)
- **Schema already migrated to Neon** — rename migration (List → Board) created and ready to apply