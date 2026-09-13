# Collaborative Kanban Todo App — Technical Design Document (TRD)

## 1. Stack & Versions

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16 |
| UI Runtime | React | 19 |
| Styling | Tailwind CSS | v4 |
| Server State / Caching | TanStack Query + Devtools | v5 |
| ORM | Prisma | Latest stable |
| Database | PostgreSQL | 16+ |
| Auth | Better Auth | Latest stable |
| Email | Resend | Latest stable |
| Drag and Drop | dnd-kit (core + sortable + utilities) | Latest stable |
| Fractional Ordering | fractional-indexing | Latest stable |
| Rate Limiting | Upstash Redis | Latest stable |
| Connection Pooling | Prisma Accelerate | Latest stable |
| Deployment | Vercel | — |

> **Note:** Route protection uses `proxy.ts` — not `middleware.ts`. This is a Next.js 16 App Router convention specific to this stack. Document this prominently in the README so contributors don't look for `middleware.ts`.

---

## 2. Architecture: Two-Cache System

> Every data-changing operation must invalidate both caches where relevant. Neither cache alone is sufficient.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TWO-CACHE SYSTEM                         │
│                                                                 │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │   Next.js fetch cache │     │  TanStack Query client cache │  │
│  │  (server-side, CDN)  │     │  (browser in-memory)         │  │
│  │                      │     │                              │  │
│  │  Invalidated via:    │     │  Invalidated via:            │  │
│  │  revalidateTag()     │     │  queryClient                 │  │
│  │  in Server Actions   │     │  .invalidateQueries()        │  │
│  │  and Route Handlers  │     │  after mutations             │  │
│  └──────────────────────┘     └──────────────────────────────┘  │
│                                                                 │
│  Tags used:                   Query keys used:                  │
│  'boards'                     boardKeys.all()                   │
│  'board-detail'               boardKeys.detail(id)              │
│  'todos'                      boardKeys.todos(id)               │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Every Server Action that mutates data calls `revalidateTag(...)` and returns enough information for the client to call `queryClient.invalidateQueries(...)`. Optimistic mutations (drag, quick-complete) update the client cache immediately via `onMutate`, then confirm/rollback after the Server Action resolves, then invalidate both caches.

---

## 3. Feature → Implementation Pattern Map

| Feature | Pattern | Why |
|---------|---------|-----|
| Dashboard — list of boards | `prefetchQuery` + `HydrationBoundary` + `useSuspenseQuery` | No-flash first paint — data arrives with HTML |
| Kanban board initial load | `prefetchQuery` (detail + todos) + `HydrationBoundary` + `useSuspenseQuery` | Board renders immediately; no loading skeleton flash |
| Near-real-time teammate sync | `useQuery` + `refetchInterval: 8000` + `staleTime: 0` | Polling every 8s; no WebSocket complexity at MVP |
| Create / rename / delete Board | Server Action + `revalidateTag('boards')` + `invalidateQueries` | Pure CRUD — no instant feedback requirement |
| Create / edit / delete Todo | Server Action + `revalidateTag('todos')` + `invalidateQueries` | Pure CRUD — side panel handles latency |
| Quick-complete ✓ toggle | `useMutation` + `onMutate` optimistic status update + rollback | Must feel instant — toggle is a reflex action |
| Drag reorder (same column) | `useMutation` + `onMutate` optimistic fractional index update + rollback | Drag feedback must be instant; server confirms after |
| Cross-column drag (status change) | `useMutation` + `onMutate` optimistic status + order update + rollback | Same — plus atomic `$transaction` server-side |
| Invite member | Server Action + `revalidateTag('board-detail')` + `invalidateQueries` | CRUD + async email side effect |
| Remove member / Leave board | Server Action + `revalidateTag('board-detail')` + `invalidateQueries` | Owner/member CRUD — no optimistic needed |
| Manage tags (create/delete) | Server Action + `revalidateTag('board-detail')` + `invalidateQueries` | Owner-only CRUD |
| Filter todos (priority/assignee/tag/date) | Client-side filter state over `useSuspenseQuery` data | All data already in client cache — no extra fetch needed |

---

## 4. Project Structure

```
├── proxy.ts                               ← Cookie-presence guard (NOT middleware.ts)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── app/
│   ├── (auth)/                            ← Route group — no shared layout with app shell
│   │   ├── sign-in/
│   │   │   └── page.tsx
│   │   ├── sign-up/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   └── verify-email/
│   │       └── page.tsx
│   ├── (app)/                             ← Route group — shared authed shell layout
│   │   ├── layout.tsx                     ← QueryProvider + global nav
│   │   ├── page.tsx                       ← Dashboard (prefetchQuery boards)
│   │   └── boards/
│   │       └── [id]/
│   │           ├── page.tsx               ← Kanban board (prefetchQuery detail + todos)
│   │           └── settings/
│   │               └── page.tsx           ← Owner-only board settings
│   ├── invite/
│   │   └── [token]/
│   │       └── page.tsx                   ← Semi-public invite landing (getOptionalSession)
│   └── api/
│       ├── auth/
│       │   └── [...all]/
│       │       └── route.ts               ← Better Auth catch-all handler
│       ├── health/
│       │   └── route.ts                   ← GET /api/health — SELECT 1 DB check
│       └── boards/
│           ├── route.ts                   ← GET /api/boards
│           └── [id]/
│               ├── route.ts               ← GET /api/boards/[id] (detail + members + tags)
│               └── todos/
│                   └── route.ts           ← GET /api/boards/[id]/todos (polled endpoint)
├── actions/
│   ├── boards.ts                          ← createBoard, renameBoard, deleteBoard
│   ├── todos.ts                           ← createTodo, updateTodo, deleteTodo,
│   │                                          updateTodoOrder, updateTodoStatusAndOrder,
│   │                                          quickCompleteTodo
│   ├── members.ts                         ← removeMember, leaveBoard
│   ├── tags.ts                            ← createTag, deleteTag
│   ├── invitations.ts                     ← createInvitation, acceptInvitation
│   └── account.ts                         ← updateName, updatePassword, deleteAccount
├── lib/
│   ├── auth.ts                            ← Better Auth server instance
│   ├── auth-client.ts                     ← Better Auth browser client
│   ├── db.ts                              ← Prisma singleton
│   ├── email.ts                           ← Resend SDK wrapper
│   ├── session.ts                         ← getRequiredSession / getOptionalSession
│   ├── redis.ts                           ← Upstash Redis client singleton
│   ├── queries/
│   │   ├── boards.ts                      ← boardKeys + boardsQueryOptions + boardDetailQueryOptions
│   │   └── todos.ts                       ← todosQueryOptions
│   └── utils/
│       ├── fractional-indexing.ts         ← generateKeyBetween wrapper with edge-case guards
│       └── invite-tokens.ts               ← Token generation + validation helpers
├── components/
│   ├── board/
│   │   ├── KanbanBoard.tsx                ← 'use client' — DndContext root
│   │   ├── KanbanColumn.tsx               ← SortableContext per column
│   │   ├── TodoCard.tsx                   ← Draggable card + ✓ quick-complete button
│   │   ├── TodoSidePanel.tsx              ← Create / edit form (all fields)
│   │   └── FilterBar.tsx                  ← Client-side filter controls
│   ├── dashboard/
│   │   ├── BoardCard.tsx
│   │   └── NewBoardModal.tsx
│   ├── settings/
│   │   ├── MemberList.tsx
│   │   ├── InviteForm.tsx
│   │   └── TagManager.tsx
│   └── ui/                                ← Shared primitives (Button, Input, Badge,
│       │                                      Avatar, Modal, SidePanel, Toast…)
│       └── ...
└── providers/
    └── QueryProvider.tsx                  ← TanStack Query client + devtools (dev only)
```

---

## 5. Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// BETTER AUTH MODELS
// ============================================

model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions      Session[]
  accounts      Account[]
  ownedBoards   Board[]       @relation("BoardOwner")
  memberships   BoardMember[]
  assignedTodos Todo[]        @relation("TodoAssignee")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?   @db.Text
  refreshToken          String?   @db.Text
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?   @db.Text
  password              String?   @db.Text
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

// ============================================
// DOMAIN MODELS
// ============================================

model Board {
  id          String       @id @default(cuid())
  name        String
  ownerId     String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  owner       User         @relation("BoardOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members     BoardMember[]
  todos       Todo[]
  tags        Tag[]
  invitations Invitation[]

  @@index([ownerId])
}

model BoardMember {
  id       String   @id @default(cuid())
  boardId  String
  userId   String
  joinedAt DateTime @default(now())

  board    Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([boardId, userId])
  @@index([boardId])
  @@index([userId])
}

model Invitation {
  id        String           @id @default(cuid())
  boardId   String
  email     String
  token     String           @unique
  status    InvitationStatus @default(PENDING)
  expiresAt DateTime
  createdAt DateTime         @default(now())

  board     Board            @relation(fields: [boardId], references: [id], onDelete: Cascade)

  @@index([boardId])
  @@index([email])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
}

model Tag {
  id        String    @id @default(cuid())
  name      String
  color     String
  boardId   String
  createdAt DateTime  @default(now())

  board     Board     @relation(fields: [boardId], references: [id], onDelete: Cascade)
  todos     TodoTag[]

  @@unique([boardId, name])
  @@index([boardId])
}

model Todo {
  id          String     @id @default(cuid())
  title       String
  description String?    @db.Text
  status      TodoStatus @default(TO_DO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  order       String
  boardId     String
  assigneeId  String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  board       Board      @relation(fields: [boardId], references: [id], onDelete: Cascade)
  assignee    User?      @relation("TodoAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  tags        TodoTag[]

  @@index([boardId])
  @@index([assigneeId])
  @@index([boardId, status])
}

model TodoTag {
  todoId String
  tagId  String

  todo   Todo   @relation(fields: [todoId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([todoId, tagId])
  @@index([todoId])
  @@index([tagId])
}

enum TodoStatus {
  TO_DO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

---

## 6. Auth Implementation Plan

### `lib/auth.ts` — Server Instance

```typescript
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { emailAndPassword } from 'better-auth/plugins'
import { db } from '@/lib/db'

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  plugins: [
    nextCookies(),
    emailAndPassword({
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: 'Verify your email',
          template: 'verify-email',
          props: { url },
        })
      },
      sendResetPasswordEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: 'Reset your password',
          template: 'reset-password',
          props: { url },
        })
      },
    }),
  ],
  session: {
    expiresIn:   60 * 60 * 24 * 7,  // 7 days absolute
    updateAge:   60 * 60 * 24,       // extend session if >24h old on request
    cookieCache: {
      enabled: true,
      maxAge:  60 * 5,               // 5-min client cookie cache — reduces DB hits
    },
  },
  rateLimit: {
    enabled: true,
    window:  60,
    max:     10,
  },
})
```

### `lib/auth-client.ts` — Browser Client

```typescript
import { createAuthClient } from 'better-auth/react'

export const { useSession, signIn, signUp, signOut } = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})
```

### `app/api/auth/[...all]/route.ts` — Catch-all Handler

```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

### `lib/session.ts` — Session Helpers

```typescript
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function getRequiredSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in')
  return session
}

export async function getOptionalSession() {
  try {
    return await auth.api.getSession({ headers: await headers() })
  } catch {
    return null
  }
}
```

### `proxy.ts` — Cookie-Presence Guard

```typescript
import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!sign-in|sign-up|forgot-password|reset-password|verify-email|invite|api/auth|api/health|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
```

---

## 7. API Surface

### Route Handlers (Reads Only)

| Method | Route | Auth | Prisma Query Strategy |
|--------|-------|------|-----------------------|
| `GET` | `/api/boards` | `getRequiredSession()` | `findMany` where `ownerId = userId` OR `members.some({ userId })`. Include `_count` for member + open todo counts. |
| `GET` | `/api/boards/[id]` | `getRequiredSession()` + membership check | `$transaction([findBoard, findMembers, findTags])` — one DB round-trip for all board metadata |
| `GET` | `/api/boards/[id]/todos` | `getRequiredSession()` + membership check | `findMany` where `boardId`. Include `assignee: { select: { id, name, image } }` and `tags`. Supports optional `?status=` filter param. `orderBy: { order: 'asc' }` |
| `GET` | `/api/health` | None | `db.$queryRaw\`SELECT 1\`` — returns `200 OK` or `503` |

**Membership check pattern** (used in `/api/boards/[id]` and `/api/boards/[id]/todos`):

```typescript
const membership = await db.boardMember.findFirst({
  where: { boardId: id, userId: session.user.id }
})
const isOwner = board.ownerId === session.user.id
if (!membership && !isOwner) return new Response('Forbidden', { status: 403 })
```

---

### Server Actions

```typescript
// actions/boards.ts
export async function createBoard(name: string)
export async function renameBoard(boardId: string, name: string)     // owner only
export async function deleteBoard(boardId: string)                   // owner only

// actions/todos.ts
export async function createTodo(boardId: string, data: CreateTodoInput)
export async function updateTodo(todoId: string, data: UpdateTodoInput)
export async function deleteTodo(todoId: string)
export async function quickCompleteTodo(todoId: string)            // sets status: DONE
export async function updateTodoOrder(todoId: string, newOrder: string)
export async function updateTodoStatusAndOrder(                    // cross-column drag
  todoId: string,
  newStatus: TodoStatus,
  newOrder: string
)

// actions/members.ts
export async function removeMember(boardId: string, userId: string) // owner only
export async function leaveBoard(boardId: string)                    // member only (not owner)

// actions/tags.ts
export async function createTag(boardId: string, name: string, color: string)  // owner only
export async function deleteTag(tagId: string)                                 // owner only

// actions/invitations.ts
export async function createInvitation(boardId: string, email: string)  // owner only
export async function acceptInvitation(token: string)

// actions/account.ts
export async function updateName(name: string)
export async function updatePassword(currentPassword: string, newPassword: string)
export async function deleteAccount()
```

**Auth check pattern inside every Server Action:**

```typescript
// 1. Authenticate
const session = await getRequiredSession()

// 2. Authorize (for owner-only actions)
const board = await db.board.findUniqueOrThrow({ where: { id: boardId } })
if (board.ownerId !== session.user.id) throw new Error('Forbidden')

// 3. Authorize (for member+owner actions)
const isMember = await db.boardMember.findFirst({
  where: { boardId, userId: session.user.id }
})
if (!isMember && board.ownerId !== session.user.id) throw new Error('Forbidden')

// 4. Mutate
// ...

// 5. Invalidate Next.js cache
revalidateTag('todos')

// 6. Return for client to invalidate TanStack Query cache
return { success: true }
```

---

## 8. TanStack Query Layer

### Query Keys & Options (`lib/queries/boards.ts`)

```typescript
import { queryOptions } from '@tanstack/react-query'

export const boardKeys = {
  all:    ()           => ['boards']               as const,
  detail: (id: string) => ['boards', id]           as const,
  todos:  (id: string) => ['boards', id, 'todos']  as const,
}

export const boardsQueryOptions = () =>
  queryOptions({
    queryKey:  boardKeys.all(),
    queryFn:   () => fetch('/api/boards').then(r => r.json()),
    staleTime: 30_000,
    gcTime:    300_000,
  })

export const boardDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey:  boardKeys.detail(id),
    queryFn:   () => fetch(`/api/boards/${id}`).then(r => r.json()),
    staleTime: 30_000,
    gcTime:    300_000,
  })

export const todosQueryOptions = (id: string) =>
  queryOptions({
    queryKey:        boardKeys.todos(id),
    queryFn:         () => fetch(`/api/boards/${id}/todos`).then(r => r.json()),
    staleTime:       0,
    gcTime:          300_000,
    refetchInterval: 8_000,
    retry:           3,
  })
```

### Prefetch Points (Server Components)

```typescript
// app/(app)/page.tsx — Dashboard
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'

export default async function DashboardPage() {
  const queryClient = new QueryClient()
  await queryClient.prefetchQuery(boardsQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  )
}

// app/(app)/boards/[id]/page.tsx — Kanban Board
export default async function BoardPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const queryClient = new QueryClient()

  await Promise.all([
    queryClient.prefetchQuery(boardDetailQueryOptions(id)),
    queryClient.prefetchQuery(todosQueryOptions(id)),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <KanbanBoard boardId={id} />
    </HydrationBoundary>
  )
}
```

### Mutation Patterns

#### Quick-complete ✓ button (`useMutation` + optimistic)

```typescript
const queryClient = useQueryClient()

const completeMutation = useMutation({
  mutationFn: (todoId: string) => quickCompleteTodo(todoId),

  onMutate: async (todoId) => {
    await queryClient.cancelQueries({ queryKey: boardKeys.todos(boardId) })
    const previous = queryClient.getQueryData(boardKeys.todos(boardId))

    queryClient.setQueryData(boardKeys.todos(boardId), (old: Todo[]) =>
      old.map(t => t.id === todoId ? { ...t, status: 'DONE' } : t)
    )

    return { previous }
  },

  onError: (_err, _todoId, context) => {
    queryClient.setQueryData(boardKeys.todos(boardId), context?.previous)
    toast.error('Failed to complete todo — changes reverted')
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
  },
})
```

#### Cross-column drag (`useMutation` + optimistic — most complex mutation)

```typescript
const reorderMutation = useMutation({
  mutationFn: ({ todoId, newStatus, newOrder }: DragPayload) =>
    updateTodoStatusAndOrder(todoId, newStatus, newOrder),

  onMutate: async ({ todoId, newStatus, newOrder }) => {
    await queryClient.cancelQueries({ queryKey: boardKeys.todos(boardId) })
    const previous = queryClient.getQueryData(boardKeys.todos(boardId))

    queryClient.setQueryData(boardKeys.todos(boardId), (old: Todo[]) =>
      old.map(t =>
        t.id === todoId
          ? { ...t, status: newStatus, order: newOrder }
          : t
      )
    )

    return { previous }
  },

  onError: (_err, _vars, context) => {
    queryClient.setQueryData(boardKeys.todos(boardId), context?.previous)
    toast.error('Reorder failed — changes reverted')
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: boardKeys.todos(boardId) })
  },
})
```

---

## 9. Performance, Scalability & Availability

### Performance Targets

| Operation | Target | Mechanism |
|-----------|--------|-----------|
| Dashboard first paint | < 200ms | Server-side `prefetchQuery` — data arrives with HTML |
| Kanban board first paint | < 300ms | Server-side `prefetchQuery` for detail + todos |
| Quick-complete ✓ | 0ms perceived | `onMutate` optimistic update |
| Drag reorder / cross-column | 0ms perceived | `onMutate` optimistic update |
| Todo create / edit (side panel) | < 500ms | Server Action + invalidate |
| Teammate changes visible | ≤ 8 seconds | `refetchInterval: 8000` |
| Invite email delivery | < 5 seconds | Resend p99 SLA |

### Per-Query `staleTime` / `gcTime`

| Query | `staleTime` | `gcTime` | Reasoning |
|-------|------------|---------|-----------|
| `boardsQueryOptions` | 30,000ms | 300,000ms | Boards change rarely — safe to cache |
| `boardDetailQueryOptions` | 30,000ms | 300,000ms | Members + tags are owner-only mutations |
| `todosQueryOptions` | 0ms | 300,000ms | `staleTime: 0` ensures every poll fetches fresh data |

### N+1 and Over-fetch Mitigations

| Risk | Query Pattern |
|------|--------------|
| Todos → loop for assignee | `include: { assignee: { select: { id, name, image } } }` in one query |
| Todos → loop for tags | `include: { tags: { include: { tag: { select: { id, name, color } } } } }` in one query |
| Dashboard → loop for member/todo counts | `_count: { select: { members: true, todos: { where: { status: { not: 'DONE' } } } } }` |
| Board detail → separate queries for members + tags | `$transaction([findBoard, findMembers, findTags])` — one round-trip |
| Cross-column drag → separate status + order updates | `$transaction` — atomic update of both fields |

---

### Scalability

**Expected load shape:** Read-heavy, bursty writes. The dominant load pattern is polling: at 5,000 users with 20% concurrently active (~1,000 users), each polling the todos endpoint every 8 seconds = **~125 DB reads/second** at steady state.

**Connection pooling (critical on Vercel serverless):**

Vercel deploys as serverless functions. Each invocation can open a new Postgres connection. Without pooling, connection exhaustion is a real failure mode at medium scale.

> **Solution:** Prisma Accelerate — sits between the app and Postgres, maintains a persistent pool, and optionally caches repeated identical queries at the edge. Configure via `DATABASE_URL` pointing to the Accelerate endpoint (not directly to Postgres). Prisma Accelerate's response caching can serve repeated todos polling responses from edge cache (short TTL: 4–8s) without hitting Postgres.

**`lib/db.ts` — Prisma Singleton:**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

**Pagination strategy:**

| Data | MVP Strategy | Threshold / Follow-up |
|------|-------------|----------------------|
| Todos per board | Fetch all, grouped by status | Soft UI warning at 200. `?status=` filter param already supported. Paginate at 500+ |
| Boards per user | Fetch all | Paginate if a user exceeds 50 boards (unlikely at MVP) |
| Members per board | Fetch all | Paginate if a board exceeds 50 members (unlikely at MVP) |
| Invitations | Fetch all pending | Hard-delete `ACCEPTED` + `EXPIRED` records older than 30 days via Vercel Cron |
| Comments (post-MVP) | `useInfiniteQuery` from day one | Never fetch as a full list |
| Activity log (post-MVP) | `useInfiniteQuery` from day one | Never fetch as a full list |

---

### Availability

> **Uptime target:** 99.9% monthly (~43 min/month allowable downtime). Daily-use work tool.

**Graceful degradation behavior:**

| Failure Scenario | Behavior |
|-----------------|----------|
| DB briefly down | `getRequiredSession()` surfaces return `503` with friendly error page. `/invite/[token]` (`getOptionalSession`) renders error state without crashing |
| Polling request fails | TanStack Query retries 3× with exponential backoff. User sees stale data + toast: *"Having trouble syncing — retrying…"* |
| Resend down during invite | Invitation record still created. Server Action returns warning: *"Invite saved but email failed — share the link manually."* Invite URL remains valid |
| Resend down during sign-up | Account created but unverified. UI shows: *"Didn't get the email? Resend it."* Better Auth handles retry |
| Prisma Accelerate pool exhausted | Returns `503`. App surfaces generic error — never exposes DB internals |

**Rate limiting:**

| Endpoint / Action | Limit | Implementation |
|-------------------|-------|---------------|
| `POST /api/auth/sign-in` | 10 req / 60s / IP | Better Auth built-in `rateLimit` |
| `POST /api/auth/sign-up` | 10 req / 60s / IP | Better Auth built-in `rateLimit` |
| `POST /api/auth/forgot-password` | 5 req / 60s / IP | Better Auth built-in `rateLimit` |
| `createInvitation` Server Action | 20 invitations / hour / userId | Upstash Redis counter |
| `GET /invite/[token]` | 30 req / 60s / IP | Upstash Redis counter |

**Upstash Redis client (`lib/redis.ts`):**

```typescript
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

**Health check (`app/api/health/route.ts`):**

```typescript
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'db_unreachable' }, { status: 503 })
  }
}
```

---

## 10. Security

### Authentication vs. Authorization Boundaries

| Layer | What It Checks | Where |
|-------|---------------|-------|
| `proxy.ts` | Cookie presence only — *"is there a session cookie?"* | Edge, no DB hit. UX redirect only |
| `getRequiredSession()` | Valid unexpired session in DB — *"is this real?"* | Every Server Component, Action, Route Handler |
| Membership check | *"Is this user a member or owner of this board?"* | Inside Route Handlers + Server Actions, after session check |
| Ownership check | *"Is this user the owner of this board?"* | Owner-only Server Actions and UI gating |

> **Critical:** `proxy.ts` is UX-level only. A user who bypasses the cookie check still hits `getRequiredSession()` before any data is read or written. Authorization (membership/ownership) is checked inside each action/handler — never assumed from the session alone.

### Password & Session Policy

- Minimum 12 characters, maximum 128 — NIST 800-63B aligned
- Bcrypt hashing via Better Auth (never store plaintext)
- Client-side password strength meter (UX only — not an enforcement gate)
- 7-day sliding session; extended by 24h on each request where session age > 24h
- Session deleted from DB on `signOut()` — not just cookie cleared
- 5-minute client cookie cache reduces DB hits without sacrificing security meaningfully

### Invite Token Security

- Token generated with `crypto.randomBytes(32).toString('hex')` — 256-bit random, cryptographically secure
- **Never use `cuid()` for invite tokens** — CUIDs are time-based and partially predictable
- 48-hour expiry enforced server-side — expired tokens rejected with a clear error message
- Rate limiting on `/invite/[token]` prevents token enumeration brute-force

### GDPR Compliance

| Requirement | Implementation |
|-------------|---------------|
| Right to erasure | `db.user.delete()` cascades through all related data via `onDelete: Cascade` on all FK relations |
| Data minimization | All Prisma queries use `select` to fetch only needed fields |
| Data retention | Invitation records: cleaned up by Vercel Cron (weekly) — hard-delete `ACCEPTED`/`EXPIRED` older than 30 days |
| Right to access/export | Post-MVP — `GET /api/me/export` returning JSON of all user data |
| DPA agreements | Non-technical requirement — must be completed with Vercel, Resend, and Prisma Accelerate/Neon before processing EU user data |

### SOC 2 Alignment

| Control | Implementation |
|---------|---------------|
| Encryption in transit | Vercel enforces HTTPS on all routes |
| Encryption at rest | Neon/Supabase/Railway encrypt Postgres volumes at rest by default |
| Password hashing | bcrypt via Better Auth |
| Auth rate limiting | Better Auth built-in `rateLimit` on all `/api/auth/*` endpoints |
| Audit logging | Post-MVP — `AuditLog` model (`userId`, `action`, `resourceType`, `resourceId`, `timestamp`, `ipAddress`). Server Actions designed to accept optional audit context so this can be added without refactoring |
| Session visibility + revocation | Post-MVP — Better Auth `listSessions()` + `revokeSession()` in account Security tab |

---

## 11. Risks, Trade-offs & Open Technical Questions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Concurrent drag-and-drop conflicts (two members drag simultaneously) | Medium | Last write wins; 8s poll self-heals. Documented known limitation. WebSocket is post-MVP resolution |
| Invite token enumeration | High | `crypto.randomBytes(32).toString('hex')` — not `cuid()`. Upstash rate limiting on `/invite/[token]` |
| Polling load at scale (125+ DB reads/sec at medium scale) | Medium | Prisma Accelerate edge caching serves repeated polling responses without hitting Postgres |
| Resend unavailable during sign-up | Medium | Better Auth "resend verification email" flow. Clear UI prompt. Resend webhook monitoring |
| >300 todos per board — payload + DOM degradation | Low-Medium | Soft UI warning at 200. `?status=` filter param already supported. `@tanstack/react-virtual` is the post-MVP fix |
| `generateKeyBetween` edge cases in `fractional-indexing` | Low | `lib/utils/fractional-indexing.ts` wrapper must guard against invalid `a >= b` boundaries, insertion at column start/end, and empty column initial key. Unit test this wrapper before M4 |

### Trade-offs

| Decision | Trade-off |
|----------|-----------|
| Polling over WebSockets | Simpler to build and debug at MVP; becomes a scaling ceiling at >10k concurrent users. WebSocket migration path is clean — TanStack Query invalidation pattern is the same regardless of push vs. pull |
| Single Owner model (no co-owners) | Simplifies authorization significantly. Limitation: if the Owner leaves a company, someone must delete + recreate the board. Post-MVP: ownership transfer action |
| Optimistic UI only on toggle + drag | Other mutations (create, edit, delete todo) go through Server Actions without optimism — there's a brief loading state on the side panel. Acceptable given the panel provides natural "pending" UX |
| Tags are per-board, not global | Avoids cross-board tag pollution. Limitation: users who want consistent tags across projects must recreate them per board. Post-MVP: tag templates |
| Fetch all todos per board | Simple and fast at <300 todos. Ceiling is real but manageable — the `?status=` escape hatch is already designed in |

### Open Technical Questions

| # | Question | Recommendation |
|---|----------|---------------|
| 1 | DONE todo behavior — always visible or collapse/archive? | Collapse DONE column after 10 items, "View all completed" expand. Decide before M4 |
| 2 | Todos assigned to a removed member — unassign or transfer? | `SetNull` (unassign) is already in schema. Confirm before M3 |
| 3 | Activity feed — MVP or post-MVP? | Firmly post-MVP. But add `AuditLog` model to schema in the first post-launch migration — retrofitting is painful |
| 4 | Vercel Cron for Invitation cleanup — Pro plan required? | Yes, Vercel Cron requires Pro plan ($20/month). Alternative: a scheduled GitHub Action hitting `/api/admin/cleanup` with a secret header. Decide before M3 |
| 5 | `proxy.ts` vs `middleware.ts` — will all contributors know this? | Document prominently in README. Add a comment at the top of `proxy.ts`: `// This file is intentionally named proxy.ts, not middleware.ts — see README for why` |