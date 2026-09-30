# Debug Journal 08: Stale Dev Route Registry — 5 Existing Routes 404

**Date:** 2026-09-30
**Severity:** Medium — dev-only, no source defect; every affected route was unreachable in `next dev` while its file sat on disk
**Files affected:** none in `app/` or `lib/` (only file mtimes were touched to force a Turbopack rescan); probe routes and scratch scripts created then deleted
**Related issue:** Continuation of the session that produced Debug Journal 07 logs (same dev-server terminal)
**Commit:** none — working tree unchanged after cleanup

---

## Symptom

Dev-server logs for a signed-in session on board `cmu1yyjde0002g4tuh1otewf9`
("Work-1-board"):

```
GET /api/notifications 200 in 3.9s (next.js: 3ms, application-code: 3.9s)
GET /api/boards/cmu1yyjde0002g4tuh1otewf9/todos 404 in 164ms (next.js: 86ms, application-code: 78ms)
GET /api/boards/cmu1yyjde0002g4tuh1otewf9/todos 404 in 44ms (next.js: 6ms, application-code: 38ms)
GET /boards/cmu1yyjde0002g4tuh1otewf9/settings 404 in 36ms (next.js: 8ms, proxy.ts: 5ms, application-code: 23ms)
GET /boards/cmu1yyjde0002g4tuh1otewf9/settings 404 in 79ms (next.js: 9ms, proxy.ts: 6ms, application-code: 64ms)
```

Notifications loaded fine; the board's todos and its settings page returned **404**.
Prisma traces in the same log showed session resolution and board/todo queries succeeding,
and the app's own "board not found" path (`app/api/boards/[id]/todos/route.ts:36-41`,
`app/(app)/boards/[id]/settings/page.tsx:34-36`) returns 404 — so the natural reading was
"data or authorization bug". The `application-code:` timings in the log reinforce that
reading (they look like handler time).

User-visible effect: the board is blank (todos API 404) and **Board Settings 404s**.

---

## Phase 1–2: Feedback Loop & Reproduction

### Discriminator: what does an *unauthenticated* request to a healthy route return?

`getRequiredSession()` (`lib/session.ts:52-63`) calls `redirect('/sign-in')` **before any
board query**, and in a Route Handler that renders as HTTP **307**. So for
`/api/boards/[id]/todos`:

- handler runs → `307` (redirect), regardless of whether the board exists
- handler never runs → routing miss → Next's built-in not-found page, `404`

That one property separates "my code 404s" from "Next never found the route", needs no
session, and no database.

### Loop (curl matrix, unauthenticated)

```bash
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/api/boards/cmu1yyjde0002g4tuh1otewf9/todos
```

```
RED: 404        (expected 307 — handler never executed)
/api/boards/[id]                    -> 307   ← same auth preamble, works
/api/boards/[id]/todos              -> 404   ← RED
/api/boards/[id]/activity           -> 404   ← RED
/api/todos/x/comments               -> 404   ← RED
/api/nonexistent-xyz                -> 404   ← control: byte-identical body
/api/invite/tok                     -> 404 {"error":"Invalid invitation link"}   ← handler's own 404
/api/me/export                      -> 401   ← handler's own response
```

**Loop criteria:** red-capable (asserts the exact symptom — 404 where 307 proves the
handler ran), deterministic, ~0.2s per path, agent-runnable, one command per path.

Body inspection made it airtight: the 404s were Next's `__next_builtin__not-found.js`
page with `"pagePath":"__next_builtin__not-found.js"` in the RSC payload — the same body a
path with no route file at all returns, **not** the route's JSON error body.

### Minimise: which routes, and is the data real?

A throwaway `pg` script (`.scratch/check-board.mjs`, deleted in cleanup) queried the
database the app actually points at:

```
board: {"id":"cmu1yyjde0002g4tuh1otewf9","name":"Work-1-board","ownerId":"3pALvn2z..."}
```

The row exists, `.env` and `.env.local` carry an identical `DATABASE_URL`, so **the data
hypothesis was eliminated before any code was read further**.

Filesystem vs. registry diff (`.next/dev/server/app-paths-manifest.json` is the dev
server's live route table):

| On disk | Registered in dev server |
|---|---|
| `app/api/boards/[id]/todos/route.ts` | **no** |
| `app/api/boards/[id]/activity/route.ts` | **no** |
| `app/api/todos/[id]/comments/route.ts` | **no** |
| `app/(app)/boards/[id]/settings/page.tsx` | **no** |
| `app/(app)/boards/[id]/activity/page.tsx` | **no** |
| everything else (`/api/boards/[id]`, `/api/notifications`, …) | yes |

Every remaining element is load-bearing: the 5 unregistered routes are exactly the 5 that
404; `/api/nonexistent-xyz` is the control that proves the 404 body is "no route here".

### Red→green in one move

```powershell
(Get-Item -LiteralPath 'app\api\boards\[id]\todos\route.ts').LastWriteTime = Get-Date
# re-run the loop
```

```
/api/boards/.../todos    -> 404   (before)
/api/boards/.../todos    -> 307   (after the file event)   ← GREEN
/api/todos/x/comments    -> 307   (after)                  ← GREEN
```

The file event made Turbopack rescan and register the route. Nothing in the source
changed — only its mtime.

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | Board row is missing (deleted, wrong id) or the app reads a different database than the one being inspected | Direct `pg` query for that id returns no row, or `.env`/`.env.local` disagree | Rejected — row found, both env files identical |
| 2 | The handler's own `if (!board) → 404` fired (data/authz path) | Unauthenticated call still reaches `getRequiredSession()` first → `307`, not `404` | Rejected — response was `404`, so the handler never ran |
| 3 | Session/auth problem (expired cookie, proxy) | Failures would vary per user and show `307 → /sign-in?callbackUrl=…&sessionExpired=true` from `proxy.ts` | Rejected — `proxy.ts` appears in the log but passes; the 404 is downstream of it, and an unauthenticated call reproduces it without any cookie |
| 4 | Next 16.3.5 can't register routes whose dynamic segment is not terminal (`boards/[id]/todos`, `todos/[id]/comments`) | A freshly created `app/api/probeA/[x]/deep/route.ts` would also 404 | Rejected — `probeA` (dynamic-then-static), `probeB` (static-nested), `probeC` (dynamic-terminal) all returned `200` immediately |
| 5 | The dev server started with an incomplete route registry in `.next/dev/server/app-paths-manifest.json`, so requests for those 5 paths fall through to the built-in not-found | Manifest lacks exactly those 5 entries; any filesystem event on the route re-registers it | **Correct** |

Proceeded with #5 — confirmed by the manifest diff and by the touch experiment *before*
any source code was treated as suspect.

---

## Phase 4: Instrumentation

No `[DEBUG-…]` tags (nothing in application code was involved). Four read-only probes:

1. **Auth-preamble discriminator** (307 vs 404) — splits "handler ran" from "route
   missing" without a session, a cookie, or a database.
2. **`.next/dev/server/app-paths-manifest.json` diffed against the `app/` tree** — the
   registry *is* the hypothesis; reading it turns a guess into a list.
3. **Control paths** (`/api/nonexistent-xyz`, `/boards/x/not-a-page`) — pin down what an
   unrouted path looks like, so "404" can't be confused with a handler's own 404 JSON
   (`/api/invite/tok`) or with `401` (`/api/me/export`).
4. **Three throwaway probe routes** — decide #4 (pattern bug) vs #5 (stale state) in one
   shot: if *new* routes work, the convention is fine and only the registry is stale.

---

## Root Cause

**File:** `.next/dev/server/app-paths-manifest.json` (dev artifact, gitignored)
**Layer:** Next 16.3.5 / Turbopack dev route registration — not application code.

**Cause:** The dev server came up with an incomplete route table. Routes whose files
existed long before the server started (`todos/route.ts` 2026-09-18,
`activity/route.ts` 2026-09-25, `comments/route.ts` 2026-09-25, both board pages) were
absent from its manifest, so:

- a request for `/api/boards/[id]/todos` resolved to nothing → Next rendered
  `__next_builtin__not-found` → **404**, before `getRequiredSession()` or any Prisma query
  could run;
- `/boards/[id]/settings` behaved the same way for the signed-in browser, producing the
  user-visible Settings 404;
- the dev log's `application-code:` segment is the not-found render, **not** the route
  handler — that timing is what makes this look like an application bug.

Nothing about the request path is wrong: board, session, schema, and handler were all
healthy. A single filesystem event on the route file (mtime change, edit, or any new file
under `app/`) makes Turbopack rescan and register it, after which the handler answers
normally.

**Why it isn't caught by tests:** `pnpm test:run` imports route modules directly and never
goes through Next's router, so a routing miss is invisible to the suite.

---

## Fixes Applied

### Fix 1: Force a rescan of the affected routes (the repair)

```powershell
(Get-Item -LiteralPath 'app\api\boards\[id]\todos\route.ts').LastWriteTime = Get-Date
(Get-Item -LiteralPath 'app\api\todos\[id]\comments\route.ts').LastWriteTime = Get-Date
(Get-Item -LiteralPath 'app\api\boards\[id]\activity\route.ts').LastWriteTime = Get-Date
(Get-Item -LiteralPath 'app\(app)\boards\[id]\activity\page.tsx').LastWriteTime = Get-Date
```

No source line was added, removed, or edited (a temporary `// TEMP-DEBUG re-register`
comment in `activity/page.tsx` was added while probing and reverted in cleanup). The app
tree is byte-identical to before the session; only mtimes moved.

### Fix 2: If it recurs — restart on a clean dev state

```bash
# stop `pnpm dev`, then
Remove-Item -Recurse -Force .next\dev
pnpm dev
```

The registry is a dev artifact; clearing it forces a full filesystem scan at startup
instead of trusting whatever the previous session left behind.

### Regression test?

**No correct seam exists — that is the finding.** Routing registration is a property of
the running dev server; there is no test that can assert "Next's in-memory route table
contains X" without starting Next. The nearest lock-down is a smoke script (see
Post-Mortem).

---

## Verification

| Check | Result |
|---|---|
| `/api/boards/[id]/todos` (was 404) | `307` — handler reached, `getRequiredSession` redirected |
| `/api/boards/[id]/activity` (was 404) | `307` |
| `/api/todos/x/comments` (was 404) | `307` |
| `/boards/[id]/settings` (was 404) | `307` → `/sign-in` (app-level, page ran) |
| `/boards/[id]/activity` (was 404) | `307` → `/sign-in` (app-level, page ran) |
| Control `/boards/x/not-a-page` | `404` — still correctly unrouted |
| Control `/api/nonexistent-xyz` | `404` — still correctly unrouted |
| Handler-owned 404 `/api/invite/tok` | `404 {"error":"Invalid invitation link"}` |
| `pnpm test:run` | 538/538 pass (49 files) |
| Probe routes (`probeA`/`probeB`/`probeC`) | deleted; `/api/probeA/1/deep` → `404` |
| Scratch scripts (`.scratch/check-board.mjs`, `.scratch/sessions.mjs`) | deleted |
| `git status` for this project | clean — no tracked file changed |
| `[DEBUG-…]` leftovers | none |

---

## Gotchas Encountered

| Gotcha | Detail | Prevention |
|---|---|---|
| `application-code:` in the dev log is not the handler | The not-found page is itself application code, so a routing miss logs `application-code: 78ms` and looks like a slow handler | Pair every timing line with a *status-discipline* check (does an unauthenticated call give 307 or 404?) before reading any handler code |
| `__next_builtin__not-found` appears in **every** page payload | It's the layout's not-found *boundary*, so a naive `-match '__next_builtin__not-found'` classifier mislabels real pages as 404s (it labelled `/sign-in` a not-found page mid-investigation) | Match the rendered marker (`<h2>This page could not be found.</h2>`), or check the status code, not a boundary reference |
| PowerShell treats `[id]` as a wildcard | `Get-Content app\api\todos\[id]\route.ts` fails with "does not exist, or has been filtered" — looks exactly like a missing file | Always `-LiteralPath` when a path contains `[`/`]` |
| `Invoke-WebRequest -Headers @{Cookie=…}` behaved differently from `curl.exe` | The PS request was intercepted by `proxy.ts` (redirect carried `callbackUrl`/`sessionExpired`) while `curl.exe` with the same cookie passed it — the "page 404s" conclusion for `/boards/*` was untestable through PS | Use `curl.exe` for header-sensitive probes; confirm which layer answered by the redirect's query params (`sessionExpired=true` ⇒ proxy, plain `/sign-in` ⇒ `getRequiredSession`) |
| The dev manifest is not a complete truth source | `(app)/boards/[id]/activity/page` stayed *absent* from `app-paths-manifest.json` while the route itself answered `307` — the file is a cache, not the router | Always confirm with a live request; the manifest is a lead, not a verdict |
| `getSessionCookie` only checks **existence** | `proxy.ts` passes any request bearing a `better-auth.session_token` cookie; real validation happens in `getRequiredSession()` | Useful as a probe: a bogus cookie reaches the page and reveals 404-vs-307 without a real session |
| Green unit tests on a routing bug | 538 tests import handlers directly, bypassing the router entirely | Treat `pnpm test:run` as evidence about *modules*, never about *routes* |

---

## Post-Mortem

### What would have prevented this

1. **A route smoke script** — the loop above, run once after `pnpm dev` comes up:

   ```bash
   # every path must NOT return Next's not-found page (403/307/401/200 are all fine)
   for p in /api/boards/x/todos /api/boards/x/activity /api/todos/x/comments \
            /boards/x/settings /boards/x/activity; do
     curl -s -o /dev/null -w "%{http_code} $p\n" -H "Cookie: better-auth.session_token=x" \
       "http://localhost:3000$p"
   done
   ```

   Any `404` that is *not* reproduced by a deliberately bogus path means the registry is
   stale → restart on a clean `.next/dev`.
2. **Read the registry first.** `.next/dev/server/app-paths-manifest.json` diffed against
   the `app/` tree took seconds and named all five routes; it is the cheapest possible
   first probe for "route 404s but the file exists".
3. **Restart on a clean `.next/dev`** as habit after a dev server has been killed or
   upgraded — the registry is persisted state from a previous session.

### Architectural follow-up

Not a code-design problem: no tangled callers, no hidden coupling — a framework dev
artifact went stale. No hand-off to `/improve-codebase-architecture` is warranted; the one
repo-level gap is the missing smoke script in Post-Mortem item 1.

### Skill process note

The temptation here was to start reading `todos/route.ts` and the settings page (both
contain a literal `404`, and the log even says `application-code`). Phase 1's
discriminator — *does an unauthenticated request give 307 or 404?* — answered the layer
question in one curl before any hypothesis about data, auth, or code was formed. The
hypothesis table then killed the "dynamic segment not terminal" theory with three probe
routes instead of a day of reading Next source.

---

## Cleanup

- `app/api/probeA`, `app/api/probeB`, `app/api/probeC` — deleted.
- `.scratch/check-board.mjs`, `.scratch/sessions.mjs`, temp copy under
  `%LOCALAPPDATA%\Temp\opencode` — deleted.
- `// TEMP-DEBUG re-register` comment in `app/(app)/boards/[id]/activity/page.tsx` —
  reverted.
- No `[DEBUG-…]` instrumentation was ever added to source; no log lines were written.
- Permanent residue: file mtimes only (git does not track them) — `git status` clean.
- The smoke script is reproduced above so it can be re-created if this returns.
