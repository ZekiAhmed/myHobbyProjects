# Debug Journal 05: Dashboard Route Move (`/` → `/boards`) + Public Landing at `/`

**Date:** 2026-09-25
**Severity:** N/A — planned route restructure, not a bug (originated from a `/grilling` interview)
**Files affected:** `app/(app)/page.tsx` (deleted), `app/(app)/boards/page.tsx`, `app/(marketing)/layout.tsx` (new), `app/(marketing)/page.tsx` (new), `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`, `app/(auth)/forgot-password/page.tsx`, `components/AppNav.tsx`, `components/board/KanbanBoard.tsx`, `components/settings/BoardSettingsClient.tsx`, `components/error-boundary.tsx`, `app/invite/[token]/page.tsx`, `app/invite/[token]/InviteClient.tsx`
**Related issue:** No tracker issue — decisions made in a `/grilling` session (grill-me skill), user confirmed the shared plan before implementation

---

## Symptom (Starting State)

`/` was the auth-gated dashboard: `app/(app)/page.tsx` wrapped by the `(app)` layout, which
calls `getRequiredSession()` at `app/(app)/layout.tsx:16`. First-time visitors, crawlers, and
signed-out users hitting the root URL were bounced to `/sign-in`. There was no public landing
page anywhere in the repo (greenfield — no `(marketing)` group, no hero components).

`/boards` (plural) already existed but only as a stub that `redirect('/')`ed back to the
dashboard.

### Route inventory (before)

| URL | File | Notes |
|---|---|---|
| `/` | `app/(app)/page.tsx` | Dashboard — session wall in `(app)` layout |
| `/boards` | `app/(app)/boards/page.tsx` | Stub → `redirect('/')` |
| `/boards/[id]`, `/boards/[id]/settings` | under `(app)/` | `getRequiredSession()` |
| `/sign-in`, `/sign-up`, `/forgot-password`, … | under `(auth)/` | Public |
| `/invite/[token]` | `app/invite/[token]/` | Semi-public (`getOptionalSession`) |

### Protection facts (found during exploration, not guessed)

- **No `middleware.ts`** — Next 16 uses `proxy.ts:28` with
  `protectedRoutes = ['/boards']` (`pathname.startsWith('/boards')`). `/` was never
  proxy-protected; its only wall was `getRequiredSession()` in the `(app)` layout.
- Post-login default was hardcoded `'/'` in `sign-in:45`, `sign-up:64`, `forgot-password:57`.
- `lib/session.ts:13` already documented `getOptionalSession()` as intended for a future
  *"Landing page, public boards (future), etc."*
- Internal `/`-meaning-dashboard links existed in 7 files (AppNav brand, mobile back arrow,
  board-delete redirect, error boundary, 4 invite CTAs).

---

## Phase 1–2: Feedback Loop & Reproduction

No reproduction needed (not a bug). The equivalent loop was a **route-map audit**:

1. Dispatched an explore agent to map every route, layout, guard, redirect, and internal
   `href="/"` reference before asking a single question — facts from the environment,
   decisions from the user (grilling skill rule).
2. Grep inventory of `href="/"`, `push('/')`, `redirect('/')`, `callbackUrl` produced the
   7-file link list above — the blast radius was known before any edit.

---

## Phase 3: Decisions (grilling interview)

One question at a time, each with a recommended answer. User confirmed all:

| # | Decision | Options considered | Outcome |
|---|----------|--------------------|---------|
| 1 | Dashboard route | `/board` (as literally requested) vs `/boards` | **`/boards`** — existing stub reused, `proxy.ts` `startsWith('/boards')` protection applies for free, no singular/plural twins |
| 2 | Logged-in user visits `/` | Landing + CTA vs auto-redirect vs identical landing | **Landing + personalized CTA** via `getOptionalSession()` (the use `lib/session.ts` was documented for) |
| 3 | Landing scope | Minimal MVP hero vs full marketing vs placeholder | **Minimal MVP hero** — headline, 3 feature cards, branched CTA |
| 4 | Landing file location | `app/(marketing)/` group vs plain `app/page.tsx` | **`(marketing)` route group** — mirrors existing `(app)`/`(auth)` convention, own layout + metadata |
| 5 | Post-auth destination | `/boards` vs keep `/` | **`/boards`** — login lands where you were going |
| 6 | AppNav brand link | `/boards` vs landing | **`/boards`** — logo behaves like "home" inside the authed shell |
| 7 | Landing metadata | Static landing metadata vs as-is vs full SEO | **Static metadata on landing** (title/description + basic openGraph); sitemap/robots out of scope |
| 8 | Plan confirmation | — | User confirmed the full shared plan before implementation began |

---

## Phase 4: Instrumentation

None. Distinguishing evidence came from the route audit, then post-change verification
(grep sweeps + curl against the live dev server) — see Verification below.

---

## Changes Applied

### 1. Dashboard moved `/` → `/boards`

- Dashboard content moved from `app/(app)/page.tsx` into `app/(app)/boards/page.tsx`
  (replacing the `redirect('/')` stub); `app/(app)/page.tsx` deleted.
- Auth wall free of charge: `(app)` layout still calls `getRequiredSession()`, and
  `proxy.ts` already matches `/boards*`.

### 2. Public landing created at `/`

```
app/(marketing)/
├── layout.tsx   ← nav (Sign in / Get started) + footer + metadata (title, description, openGraph)
└── page.tsx     ← async server component: hero, 3 feature cards, session-branched CTA
```

CTA branches server-side on `getOptionalSession()`: signed-out → "Get started" (`/sign-up`)
+ "Sign in"; signed-in → "Go to dashboard" (`/boards`).

### 3. Post-auth defaults → `/boards`

| File | Line | Change |
|---|---|---|
| `app/(auth)/sign-in/page.tsx` | 45 | `searchParams.get('callbackUrl') \|\| '/boards'` (+ doc comment line 10) |
| `app/(auth)/sign-up/page.tsx` | 64 | already-authed visitor → `push('/boards')` |
| `app/(auth)/forgot-password/page.tsx` | 57 | already-authed visitor → `push('/boards')` |

### 4. Internal links `/` → `/boards` (all "dashboard" meanings)

| File | Line(s) | Change |
|---|---|---|
| `components/AppNav.tsx` | 9 | brand wordmark → `/boards` |
| `components/board/KanbanBoard.tsx` | 375 | mobile back arrow → `/boards` |
| `components/settings/BoardSettingsClient.tsx` | 119 | post board-delete → `/boards` |
| `components/error-boundary.tsx` | 109 | "Go to Dashboard" → `/boards` |
| `app/invite/[token]/page.tsx` | 90, 108, 128 | 3 invite CTAs → `/boards` |
| `app/invite/[token]/InviteClient.tsx` | 18 | invite-failure CTA → `/boards` |

Intentionally unchanged: `(marketing)/layout.tsx` brand link stays `/` (it IS the landing).

### 5. Documentation synced (15 edits across 7 files, user-confirmed in two batches)

| File | What changed |
|---|---|
| `PRODUCT.md` | L29 operating context (public `/` landing, dashboard at `/boards`); L40 out-of-scope reworded |
| `docs/PRD.md` | out-of-scope landing row removed + shipped note; Sign In/dashboard-flow/board-delete/already-authed redirects → `/boards`; routes table split into `/` (public) + `/boards` (protected); verify-email flow corrected to actual behavior (success message, no redirect; pending invite → `/boards/[id]`) |
| `docs/TRD.md` | §4 tree adds `(marketing)/`, dashboard line moves to `boards/page.tsx`; prefetch code-comment path fixed |
| `DESIGN.md` | L281 wordmark "linking home" → "linking to the dashboard (`/boards`)" |
| `.scratch/collaborative-kanban-app/spec.md` | out-of-scope landing line annotated as shipped |
| `.scratch/.../issues/02-board-crud-and-dashboard.md` | `Dashboard page (/boards)` ×2 |
| `.../issues/08-board-settings-page.md` | delete-board redirect → `/boards` |

Audited and deliberately left untouched: `README.md` (stale commit summary, no route refs),
all 4 `docs/debugging/*.md` (matches were test-mock context), `AGENTS.md` (auto-generated
Next.js block), `CLAUDE.md`/`CONTEXT.md`/ADRs (no route references), the other 9
`.scratch/collaborative-kanban-app` files, `post-mvp-features/*`.

---

## Verification

| Check | Result |
|---|---|
| `pnpm lint` (eslint) | 0 errors |
| `npx tsc --noEmit` | 0 errors |
| `pnpm test:run` (vitest) | 34/34 pass (6 files) |
| `GET /` (live, dev :3000) | **200** — landing HTML contains hero + signed-out CTAs; `<title>` and `og:title` = "Kanban - Collaborative todo app for small teams" |
| `GET /boards` (no cookie) | **307** → `/sign-in?callbackUrl=%2Fboards&sessionExpired=true` (proxy guard intact) |
| `GET /sign-in` | 200 |
| Stale `/`-as-dashboard grep across all `*.md` | 0 matches |

Note: "Go to dashboard" correctly absent from signed-out landing HTML — CTA branches on
session server-side.

---

## Gotchas Encountered

| Gotcha | Detail | Prevention |
|---|---|---|
| `/board` vs `/boards` collision | The literal request was `/board` (singular), but `/boards` existed as a redirect stub and `proxy.ts` only matches `startsWith('/boards')` — a new `/board` would be silently un-proxy-protected | Reuse the plural route; audit existing paths before honoring a literal URL request |
| Route groups don't guard, layouts do | `(app)`/`(auth)` add no URL segment; the real auth wall was `getRequiredSession()` in the *layout*, not the proxy | When making a route public, check which layout wraps it before moving files |
| `Button` here is Base UI, not Radix shadcn | `asChild` does not exist — typecheck failed with TS2322. This codebase's Button uses the `render` prop pattern (`render={<Link href="..." />}` + `nativeButton={false}`), as seen in the invite page | Match the existing component's API; grep sibling usages before writing `asChild` code |
| Stale generated types after deleting a page | `tsc` failed on `.next/types/validator.ts` referencing the deleted `app/(app)/page.js` | Delete the stale generated file — it regenerates on next `next dev`/`build` |
| Post-auth `'/'` defaults scattered across 3 auth pages | Miss one and login lands users on the marketing page | Grep `callbackUrl|push('/')|redirect('/')` repo-wide after a route move |
| Two docs batches, not one | User asked to confirm before doc edits; scope grew each round (code docs → skipped files → `.scratch`) | Sweep *all* markdown (including dot-directories) for route references; glob patterns miss `.scratch` |

---

## Cleanup

- No `[DEBUG-...]` instrumentation was ever added.
- Deleted stale `.next/types/validator.ts` (regenerated automatically).
- `AGENTS.md`'s auto-generated nextjs-agent-rules block left as-is (re-added by `next dev`).
- Final grep sweep: zero stale `app/(app)/page`, `/ (dashboard)`, "auth-gated dashboard",
  "redirects to `/`", "Dashboard page (`/`)", "wordmark linking home" matches in any `*.md`.
