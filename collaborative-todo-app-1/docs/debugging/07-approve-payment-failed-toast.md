# Debug Journal 07: "Failed to approve payment" Toast (Unapplied Notification Migration)

**Date:** 2026-09-30
**Severity:** High — the Administrator's only way to accept money is broken (both Approve and Reject)
**Files affected:** `actions/payment-review.ts` (added error logging), `package.json` (migrate-on-dev-start), database: `prisma/migrations/20260929000000_payment_decision_notifications` (applied, was pending)
**Related issue:** `.scratch/subscription-billing/issues/07-admin-review-queue-and-approve-reject.md`, `.scratch/subscription-billing/issues/08-decision-delivery-to-subscriber.md`
**Commit:** `ff9b09e fix: log swallowed payment-decision errors and migrate on dev start`

---

## Symptom

Clicking **Approve** in the `/admin` review queue shows a red toast:

```
Failed to approve payment
```

The message is manufactured in the generic `catch` of `approveSubmission`
(`actions/payment-review.ts:204`) — it is what the action returns for *any* unexpected
exception, so the toast itself carries zero information about what failed:

```ts
} catch (error) {
  if (error instanceof GuardError) {
    return actionError(error.kind, error.message)
  }
  return actionError('server', 'Failed to approve payment')   // ← original: no logging
}
```

`handleActionResult` (`lib/toast.ts:42-49`) renders a `server` error with a **Retry** button
whose `onClick` is `() => {}` — retrying visibly did nothing, so the loop ended at "it's
broken, and the code won't say why".

---

## Phase 1–2: Feedback Loop & Reproduction

### Why the existing tests were not a loop

`actions/__tests__/payment-review.test.ts` mocks Prisma at the module boundary
(`vi.mock('@/lib/db', …)` at line 79) and drives a hand-written fake row store. All **30
tests passed** — correctly: they assert the action's *logic*, and the logic was never wrong.
They cannot see the real database schema, so they cannot go red on this bug. A green suite
here proved nothing about the environment.

### Why not the browser

An end-to-end loop (sign in as the Administrator → click Approve → assert the toast) needs
credentials this session doesn't have, and the failure needs a live PENDING submission plus
a signed session. That loop would have been a human-in-the-loop script — the skill's last
resort.

### The loop that worked: replay the write-set, roll it back

`approveSubmission` is a transaction whose only writes are: flip the submission, extend the
subscriber's period, insert the decision Notification. Replaying exactly those statements
against the real Neon database inside `BEGIN … ROLLBACK` reproduces the failure with the
production connection, the production schema, and **no persistent side effects**.

`tmp-approve-probe.cjs` (throwaway, deleted in cleanup):

```js
require('dotenv').config()
const { Client } = require('pg')
// BEGIN → read the PENDING submission → UPDATE status → UPDATE period end →
// INSERT INTO "Notification" (type='PAYMENT_APPROVED', boardId NULL, todoId NULL) → ROLLBACK
// exit 1 with the message if any statement throws
```

### Red run (verbatim)

```bash
node .\tmp-approve-probe.cjs
```

```
RED: invalid input value for enum "NotificationType": "PAYMENT_APPROVED"
  code: 22P02
```

**Loop criteria:** red-capable (asserts the statement that fails in production),
deterministic, ~2s, agent-runnable, one command, no writes surviving the run.

### Corroborating one-liner (the check that should have come first)

```bash
pnpm prisma migrate status
```

```
11 migrations found in prisma/migrations
Following migration have not yet been applied:
20260929000000_payment_decision_notifications
```

### Minimised repro

Statements tried one at a time inside the same transaction:

| Step | Statement | Result |
|---|---|---|
| 1 | `UPDATE "PaymentSubmission" … status='APPROVED'` | OK |
| 2 | `UPDATE "User" … "subscriptionPeriodEnd"` | OK |
| 3 | `INSERT INTO "Notification" … 'PAYMENT_APPROVED', NULL, NULL` | **RED — 22P02** |

Every remaining element is load-bearing: drop step 3 and the loop goes green. The failing
seam is exactly `actions/payment-review.ts:159` (`tx.notification.create`, mirrored at
`:284` in `rejectSubmission` — reject was equally broken).

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | `20260929000000_payment_decision_notifications` was written but never applied to Neon, so the `NotificationType` enum lacks `PAYMENT_APPROVED`/`PAYMENT_REJECTED` and `boardId`/`todoId` are still `NOT NULL` | `prisma migrate status` reports it pending; a bare INSERT of the decision payload fails `22P02` / `23502` | **Correct** |
| 2 | `isolationLevel: 'Serializable'` conflicts against Neon's pooler (`P2034`), the one approval-specific difference from reject | Probe fails only under concurrency, with a serialization error, and a single sequential run stays green | Rejected — a single sequential run was red with `22P02`, a value error no isolation level can cause |
| 3 | `revalidateTag('notifications', 'max')` is invalid in Next 16.3.5 and throws after the commit | Failure would occur *after* the period was applied (subscriber extended, toast still errors); docs forbid the 2-arg form | Rejected — `revalidateTag.md:35` documents `revalidateTag(tag, profile)` as the current signature, and the probe (no `revalidateTag` involved) was already red |
| 4 | Expired session: `getRequiredSession()` → `redirect()` is not a `GuardError`, so the catch collapses it into a generic server error | Every protected action fails the same way for that user; reproducible only with a signed-out/expired cookie | Rejected as *the* cause — the session-free DB probe reproduced a red failure of its own, and a DB-level cause is sufficient. Kept as a latent hazard (see Gotchas) |

Proceeded with #1, which was confirmed by the red probe and by `migrate status` before any
code was read further.

---

## Phase 4: Instrumentation

No `[DEBUG-…]` tags. Two boundary probes did the work:

1. **`prisma migrate status`** — distinguishes "schema drift" (#1) from "application bug"
   (#2–#4) in under a second. This is the probe that maps to hypothesis #1's prediction.
2. **The rollback probe** — asserts the exact failing statement, i.e. the exact user
   symptom's cause, against the real database.

Adding `console.error` to the catch was a *fix*, not an instrument: the cause was already
known by then, and the missing log was itself a defect (see Post-Mortem).

---

## Root Cause

**File:** `actions/payment-review.ts:159` (and `:284`)
**Layer:** database schema vs. repository migrations — not application code.

**Cause:** Issue 08 (decision delivery) added the in-app Notification to the decision
transaction and shipped the migration that makes it possible:

```sql
-- prisma/migrations/20260929000000_payment_decision_notifications/migration.sql
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_REJECTED';
ALTER TABLE "Notification" ALTER COLUMN "boardId" DROP NOT NULL;
ALTER TABLE "Notification" ALTER COLUMN "todoId" DROP NOT NULL;
```

The file was committed; the migration was never executed against the shared Neon database.
So `boardId`/`todoId` were still `NOT NULL` and the enum was still `{ASSIGNED, COMMENTED}`.
The first approval (or rejection) to run `tx.notification.create({ type: 'PAYMENT_APPROVED',
boardId: null, todoId: null })` was rejected by Postgres with `22P02`. That error is not a
`GuardError`, so the `catch` reduced it to `actionError('server', 'Failed to approve
payment')` — a generic toast, an empty Retry, and no server log line.

The status flip and the period extension in steps 1–2 were fine; the transaction rolled back
on step 3, so no half-applied state was left behind (the atomic-transaction design from
issue 07 contained the blast radius correctly).

---

## Fixes Applied

### Fix 1: Apply the migration (the actual repair)

```bash
pnpm prisma migrate deploy
# migrations/ └─ 20260929000000_payment_decision_notifications/ └─ migration.sql
# All migrations have been successfully applied.
```

No code change was required for approval to work again — the code was correct all along.

### Fix 2: Log the swallowed cause (`actions/payment-review.ts`)

```ts
// Before
return actionError('server', 'Failed to approve payment')

// After
console.error('[payment-review] approveSubmission failed', error)
return actionError('server', 'Failed to approve payment')
```

Same for `rejectSubmission` (`:319`). The caller still gets the generic message; the dev
server now gets the real one.

### Fix 3: Migrations at startup (`package.json`)

```json
"dev": "prisma migrate deploy && next dev",
"db:migrate": "prisma migrate deploy"
```

Schema drift now fails **before** the server starts, instead of at the first write that
needs the new column/enum value.

### Regression test?

**No correct seam exists** — that is the finding. Every test in
`actions/__tests__/` mocks `@/lib/db`, so no test can observe the real schema; a test that
asserted "the enum contains `PAYMENT_APPROVED`" would have to open a live connection, which
this repo's suite never does. The guard that now locks the bug down is
`prisma migrate deploy` on `pnpm dev` (plus `pnpm db:migrate` for any deploy target).

---

## Verification

| Check | Result |
|---|---|
| Rollback probe (was red) | `GREEN: approval write-set is insertable` |
| `pnpm prisma migrate status` | `Database schema is up to date!` |
| `pnpm run db:migrate` ×3 consecutive | exit 0 each (`No pending migrations to apply`) |
| `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | `No difference detected.` (exit 0) |
| `pnpm vitest run actions/__tests__/payment-review.test.ts` | 30/30 pass |
| `pnpm vitest run actions/__tests__ components/admin/__tests__` | 183/183 pass (13 files) |
| `pnpm lint` | clean |
| End-to-end click on `/admin` | left to the human — no credentials in this session |
| `[DEBUG-…]` leftovers | none |

---

## Gotchas Encountered

| Gotcha | Detail | Prevention |
|---|---|---|
| The catch block never logged | `actionError('server', …)` is a *message for the user*, not for the developer — the real error was discarded the moment it was caught | Log before collapsing: `console.error('[scope] <action> failed', error)` in every generic catch (added for approve/reject; **25 `Failed to …` returns across 10 other action files still swallow** — see Post-Mortem) |
| Green test suite on a schema bug | `payment-review.test.ts` mocks `@/lib/db`, so it validates logic, never schema | Treat "unit tests pass" as evidence about *code*, not about the *database*; reach for `prisma migrate status` |
| Retry button is a no-op | `lib/toast.ts:46` — `onClick: () => {}`, so the user's natural retry did nothing and looked like a second failure | Either wire it to a re-invalidate or drop the action; don't offer a button that silently does nothing |
| PowerShell `Select-Object -Last` can kill its producer | `pnpm prisma migrate deploy \| Select-Object -Last 15` terminated the pipeline once enough lines arrived, leaving Prisma killed mid-run | Redirect to a file (`*> mig.log`) when a command must run to completion |
| A killed migrate leaks the pooler advisory lock | The next `prisma migrate deploy` failed with `Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(72707369))` — the lock is session-scoped and survives through Neon's `-pooler` endpoint until PgBouncer recycles the backend | Re-run (self-heals in seconds), and never interrupt a migration; prefer a direct (non-pooled) URL for migrations if this recurs |
| `redirect()` is not a `GuardError` | `getRequiredSession()` on an expired session throws `NEXT_REDIRECT`, which `payment-review`'s catch would also flatten into `Failed to approve payment` | Worth a follow-up: rethrow `NEXT_REDIRECT` (and `forbidden()`) before the generic catch in server actions |

---

## Post-Mortem

### What would have prevented this

1. **Migrations applied at startup** — done: `prisma migrate deploy` now runs before
   `next dev`. The migration existed, was correct, and was reviewed; it simply never
   reached the database it was written for.
2. **Error logging in the generic catch** — done for `payment-review`. The toast string
   was the *only* artifact of a fully-determined error; a single `console.error` would have
   named the enum in the dev-server terminal on the first click.
3. **A schema check in CI / pre-merge** — still missing. Prisma 7's `migrate status` has no
   `--exit-code` (verified against `--help`), so gate on a diff instead — verified working
   against this repo:

   ```bash
   pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
   # No difference detected.   exit 0 = in sync, 2 = drift, 1 = error
   ```

   Needs a database connection but executes no queries beyond the catalog read, and fails a
   PR whose schema moved without a migration.
4. **An honest test seam** — the repo's action tests mock Prisma everywhere, so *no*
   failure mode that lives in SQL can turn a test red. That's a deliberate speed trade-off,
   but it means environmental bugs are invisible to `pnpm test:run`.

### Architectural follow-up

Two candidates, in order of leverage:

1. **Migration gate in CI** — `prisma migrate diff --from-config-datasource --to-schema
   prisma/schema.prisma --exit-code` (verified: exit 0 when in sync, 2 on drift), so schema
   drift fails the pipeline instead of the first write in production.
2. **A `guard()` wrapper for server actions** — every action repeats
   `try { … } catch (e) { if (e instanceof GuardError) …; return actionError('server', …) }`
   with no logging and no rethrow for Next.js control-flow errors (`redirect`,
   `forbidden`). One wrapper that logs, rethrows framework interrupts, and returns the
   generic error would close this class for all 27 `Failed to …` catches at once.

Hand off to `/improve-codebase-architecture` with: *"server-action catch blocks swallow
framework control-flow errors and never log; migrations have no CI gate."*

---

## Cleanup

- `tmp-approve-probe.cjs`, `tmp-checkdb.cjs`, `tmp-locks.cjs`, `mig_*.log`, `diff.log` —
  deleted.
- No `[DEBUG-…]` instrumentation was ever added to source.
- Permanent residue is intentional and minimal: two `console.error` lines, two
  `package.json` script entries, and the applied migration.
- Probe script is reproduced above so it can be re-created if this class of bug returns.
