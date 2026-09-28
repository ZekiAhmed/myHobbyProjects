# 07 — Admin review queue & approve/reject

**What to build:** The Administrator opens the review queue: pending submissions oldest-first, each with an aging badge ("18h left", OVERDUE past 24 hours), the expected amount (snapshot), submitter name/email, submission time, and payment reference. The receipt image/PDF is viewable behind the admin gate. Approve sets the subscriber's period end — starting the clock now, or stacking onto the current period end if already active — under a terminal-state guard so double-clicks and stale tabs cannot double-apply. Reject requires a non-empty reason and is guarded the same way. A transfer without the memo reference is still approvable via the amount + sender name + date fallback shown on the review card.

**Blocked by:** 01 — Platform Administrator role & gate, 03 — Subscription date & entitlement math, 05 — Receipt upload → review queue.

**Status:** done

- [x] Admin-only queue route returns pending submissions oldest-first with aging/OVERDUE badges
- [x] Receipt viewer is admin-gated; regular users get 403
- [x] Approve action transitions PENDING → APPROVED and sets period end via the pure helpers (now-or-stacked), atomically with guards
- [x] Reject action transitions PENDING → REJECTED with a mandatory reason; empty reason is rejected
- [x] Review card shows snapshot amount, submitter identity, submission time, reference, supporting fallback matching
- [x] Non-administrators are rejected from every queue/viewer/action path
- [x] Tests cover ordering, badges, both transitions, terminal-state guards, required reason, and authorization

## Comments

Shipped as three layers, each gated independently:

- **Read** — `GET /api/admin/review-queue` (session → platform-role check → 403 JSON → `findMany` where `status: PENDING`, `orderBy updatedAt asc` — queue entry, longest waiting first —, metadata only; no receipt bytes and no constant `status` on the wire). `GET /api/receipts?reference=…` streams the stored blob behind the same role check with a sniffed `Content-Type` and `Cache-Control: private, no-store`.
- **Decide** — `actions/payment-review.ts`: `approveSubmission` / `rejectSubmission`, both authorization-first (re-checked server-side), zod-validated (reason trimmed, 1–500 chars), and one transaction each. Both writes carry `status: PENDING` in the WHERE as a compare-and-swap, so double-clicks, stale tabs, and a second Administrator lose the race with `GuardError('validation', 'already been decided')` instead of double-applying. Approval computes `computePeriodEnd(now, currentEnd)` (stacks an active period, restarts a lapsed one) and runs at `isolationLevel: 'Serializable'` — the one read-modify-write in billing.
- **Surface** — `components/admin/ReviewQueue.tsx` behind the page's `requireAdmin()`: card per submission with `reviewAgeBadge` aging label ("18h left" → "OVERDUE" at 24h, floors down so it never overclaims), snapshot amount, name/email, submission `<time>`, reference, admin receipt link, and the amount + sender + date hint for a transfer that arrived without the memo. The queue is the app's one polling read (`refetchInterval` 60s, `staleTime` 0) so badges in a left-open tab stay honest; every decision invalidates `adminKeys.reviewQueue()` so a decided card leaves the list. The subscriber's own surfaces never poll (issue 06 decision held).

Aging helper is pure (`lib/review-aging.ts`), unit-tested with explicit `now`. Rejection is terminal too: a decided submission cannot be re-rejected to rewrite its stored reason.

Schema: migration `20260928140000_payment_decision` adds `PaymentSubmission.decidedAt/decidedById/rejectionReason` + `decidedBy` relation, and `User.subscriptionPeriodEnd`.

### Code review follow-ups (both axes run before commit)

Fixed:

- **The 24-hour clock had the wrong anchor.** The badge and the card's "Submitted" time were computed from `createdAt` — the payment-*instruction* creation with a 48-hour TTL — so a receipt uploaded near the end of that TTL would render OVERDUE the instant it entered review. Both now use `updatedAt` (on a PENDING row that is exactly the receipt-landing instant), the queue orders on it too, and a regression test pins "30h old instructions + 1h old receipt → 23h left". `createdAt` stays on the card as the transfer-initiated date the fallback hint matches on.
- **Shared Administrator gate**: the verbatim `refuseUnlessAdministrator` copies in `actions/admin.ts` and `actions/payment-review.ts` (plus the inline check in `actions/pricing-settings.ts`) collapsed into `lib/admin-guard.ts`, so the authorization check cannot drift between admin actions as more land (08, 11).
- **Toasts now go through `lib/toast.ts`** (`handleActionResult` / `handleMutationError`) per spec §Conventions, with one deliberate exception: `handleActionResult` silently swallows `validation` errors, which would make an "already been decided" refusal look like a dead button, so the component's `onError` echoes that branch (authorization/server still come from the helper).
- `## Comments` heading, per `docs/agents/issue-tracker.md`.

Accepted after review (noted, not changed):

- The route is not listed in proxy's `protectedRoutes`: its matcher excludes `/api` entirely, and issue 05's viewer route has the same story — both rely on in-handler session + role checks (tested).
- `formatTimestamp`/`isoTimestamp` are duplicated from `BillingHistory.tsx`; cosmetic-only helpers, extraction deferred until a third call site appears.
- Polling (`refetchInterval` 60s), the 500-char reason cap, and the receipt filename on `Content-Disposition` are deliberate additions beyond the literal spec text.
