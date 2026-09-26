# Spec: Manual bank-transfer subscription with admin approval

Status: ready-for-agent
Labels: ready-for-agent

## Problem Statement

As a board Owner, I want to pay for a monthly subscription by bank transfer and have my team join my Boards without each of them paying — but today the app has no way to collect money at all. I cannot invite my whole team without everyone paying individually (or at all), the developer has no way to know who paid, and there is no mechanism to unlock team features after a payment arrives.

Concretely, from the user's perspective:

- I want to collaborate with my team on a shared Board, but only I should have to pay for the privilege; my teammates should join via email invitation at no cost.
- I have no card/gateway option — I transfer money from my bank app. I need somewhere to send the money, a way to prove I sent it, and a clear signal when a human has confirmed it.
- While my payment is being reviewed I am in the dark: I do not know whether my upload worked, whether it was accepted, or what happens next. I need a calm, honest waiting experience that never locks me out of what I already have.
- If my subscription lapses I must not lose access to my work — I need warning before expiry, and afterwards a state that preserves my data while making it clear how to restore full access.

## Solution

A monthly subscription, settled by **manual bank transfer**, gated by **administrator approval**:

1. The Owner clicks Subscribe on the upgrade screen and immediately receives a payment instruction card: amount, bank details, and a **unique payment reference** to include in the transfer memo, plus an upload form.
2. They transfer the money in their banking app and upload the receipt (screenshot or PDF). Their submission enters the **review queue**.
3. During review the Owner sees a non-blocking **status card, dashboard banner, and billing history** — "awaiting review, within 24 hours" — and keeps using the app normally.
4. An administrator reviews the queue (oldest first, aging badge), matches amount and reference against their bank statement, and **approves or rejects with a required reason**. The Owner is notified both in-app and by email.
5. On approval, their **Pro subscription clock starts** and inviting Members to their Boards unlocks — teammates join free via the existing email Invitation flow.
6. Seven days before expiry an in-app warning banner appears; at expiry, Boards that have Members become **read-only** (data preserved, never deleted) while the Owner's solo Boards remain editable; a renew CTA allows **stacked early renewal** so a paying subscriber never falls into a locked gap.

Free tier is generous and deliberately narrow: **unlimited personal Boards, zero cost — the single paid moment is inviting a Member.**

## User Stories

### Subscribe & payment instruction

1. As a board Owner, I want to see a subscription upgrade screen showing the current price and currency, so that I know exactly what I will pay before I commit.
2. As a board Owner, I want to click "Subscribe" and instantly receive a unique payment reference, so that my transfer can be matched to my account even if I forget other details.
3. As a board Owner, I want the payment instruction card to show the account holder, account number, bank name, and any transfer instructions, so that I can complete the transfer without leaving the app.
4. As a board Owner, I want a copy-to-clipboard button for the payment reference, so that I do not transcribe it wrongly into my banking app's memo field.
5. As a board Owner, I want my payment instruction to state the exact amount to transfer, so that the administrator can verify it at a glance.
6. As a board Owner, I want my payment instruction to expire automatically after 48 hours if I never upload a receipt, so that abandoned attempts do not block me from starting fresh later.
7. As a board Owner, I want starting a new payment attempt to be blocked while I have a live attempt in progress, so that the administrator never faces duplicate spam from me.

### Receipt upload

8. As a board Owner, I want to upload my transfer receipt as a JPEG, PNG, WebP, or PDF up to 5 MB, so that I can submit proof in whatever format my banking app exports.
9. As a board Owner, I want clear validation errors when my file is the wrong type or too large, so that I can fix it immediately instead of guessing why the upload failed.
10. As a board Owner, I want a confirmation checkbox asking whether I included my reference in the transfer memo, so that I am nudged to do the one thing that makes review fastest.
11. As a board Owner, I want a definitive success screen after upload ("submitted, under review"), so that I never wonder whether my proof arrived.

### Waiting for review

12. As a board Owner with a submission under review, I want the upgrade screen to show a status card instead of the pay CTA, so that I know my upload worked and no further action is needed.
13. As a board Owner with a submission under review, I want a persistent banner on my dashboard, so that I am reminded of the pending review wherever I am.
14. As a board Owner with a submission under review, I want a billing history page listing every attempt with its status, timestamps, amount, and reference, so that I have a durable record of what I submitted and when.
15. As a board Owner with a submission under review, I want to keep using all my free features normally, so that waiting never costs me access to what I already have.
16. As a board Owner with a submission under review, I want to see the promised turnaround ("reviewed within 24 hours"), so that I can decide whether to wait or follow up.
17. As a team Member, I want the pending review of my Owner's subscription to be invisible to me, so that my collaboration experience is unaffected.

### Decision & notifications

18. As a board Owner whose payment was approved, I want an in-app Notification and an email telling me I can now invite my team, so that I learn about it whether or not I am logged in.
19. As a board Owner whose payment was rejected, I want the rejection reason shown next to my submission in billing history (e.g. "amount mismatch"), so that I know exactly what to fix.
20. As a board Owner whose payment was rejected, I want a "submit a new receipt" action that starts a fresh attempt, so that one mistake does not dead-end my subscription.
21. As a board Owner, I want my previous rejected submissions preserved in history, so that I can see the pattern of my own attempts.
22. As a board Owner, I want notification emails to be best-effort, so that an email delivery failure never rolls back my approval or rejection.

### Pro entitlement & inviting

23. As a Pro subscriber, I want to invite Members to any Board I own by email without any paywall, so that my whole team can collaborate at no cost to them.
24. As a free user, I want unlimited personal Boards with full functionality, so that I can experience the product fully before deciding to pay.
25. As a free user, I want the paywall to appear exactly when I try to invite a Member, so that the cost is tied to the moment I actually receive team value.
26. As a team Member, I want to accept an Invitation and use my Owner's Board without ever seeing a paywall or subscription prompt, so that riding on my team's subscription is genuinely free.
27. As a Pro subscriber, I want Pro to apply to every Board I own, so that I never have to manage entitlements per Board.

### Renewal, expiry & read-only

28. As a Pro subscriber approaching expiry, I want an in-app warning banner seven days before my period ends (shown only to me, never to Members), so that I can renew without interruption.
29. As a Pro subscriber, I want to renew early while still active, with the new month **stacked onto my current period end**, so that I never experience a locked gap between periods.
30. As a lapsed subscriber, I want Boards with Members to become read-only at expiry rather than disappearing or being deleted, so that my team's work is always preserved and visible.
31. As a lapsed subscriber, I want my solo Boards to stay fully editable after expiry, so that losing Pro only costs me collaboration, not my personal work.
32. As a lapsed subscriber, I want a clear renew prompt on read-only Boards explaining how to restore editing, so that recovery is self-service.
33. As a subscriber, I want my renewal date shown as a calendar date (e.g. "renews 25 March"), clamped sanely for short months (31 Jan → 28 Feb), so that it matches how every other subscription in my life works.
34. As a subscriber, I want my paid period to start at approval and run one calendar month (stacked if I renewed early), so that I always receive the full time I paid for.

### Administration

35. As an Administrator, I want a review queue of pending submissions ordered oldest-first, so that I honor the 24-hour promise fairly.
36. As an Administrator, I want an aging badge on each submission ("18h left", "OVERDUE" past 24 hours), so that I can triage at a glance.
37. As an Administrator, I want an email for every newly pending submission, so that reviews happen promptly even when I am not logged in.
38. As an Administrator, I want to view a submitted receipt image/PDF behind an authenticated route, so that I can inspect the proof.
39. As an Administrator, I want each review to show the expected amount (snapshotted at submission), the submitter's name and email, the submission time, and the payment reference, so that verification is a five-second match.
40. As an Administrator, I want to approve a submission whose transfer lacks the memo reference by matching amount, sender name, and date, so that a real payment is never refused over a formatting slip.
41. As an Administrator, I want to reject a submission only with a mandatory reason, so that the submitter can self-correct instead of contacting support.
42. As an Administrator, I want approve/reject to be guarded so only genuinely pending submissions can transition, so that double-clicks or stale tabs cannot double-apply outcomes.
43. As an Administrator, I want to promote another user to Administrator from within the app, so that I can hand off review duties without database surgery.
44. As an Administrator, I want to demote another Administrator, so that compromised or departed accounts lose access promptly.
45. As an Administrator, I want to be prevented from demoting myself, so that I cannot lock myself out by accident.
46. As an Administrator, I want to be prevented from demoting the last remaining Administrator, so that the instance is never left with nobody able to approve payments.
47. As an Administrator, I want an editable pricing and bank-details settings form (price, currency, account holder, account number, bank name, transfer instructions), so that I can change them without a redeploy.
48. As an Administrator, I want account-number input validated to 6–15 digits, so that settings typos cannot ship broken payment instructions.
49. As an Administrator, I want every submission to carry a snapshot of the price and currency in force when it was created, so that a later price change never invalidates an in-flight payment.

### Platform & data hygiene

50. As the operator, I want payment receipt bytes automatically deleted 30 days after the decision while submission metadata (amount, reference, timestamps, reviewer, outcome) is kept forever, so that the database stays lean but the financial audit trail survives.
51. As a user, I want payment decision events delivered as Notifications (never as Board Activity entries), so that the Board Activity log stays a collaboration feed per ADR-0002.
52. As a user, I want approval/rejection to be a single atomic database transaction, so that partial failures cannot leave my subscription half-applied.

## Implementation Decisions

### Domain & entitlement

- **Entitlement anchor = the subscribing user.** A user is "Pro" iff they have a current, non-expired subscription period. Pro applies to every Board that user **owns** (`Board.ownerId`); Members acquire no status of their own. No Team/Organization entity is introduced.
- **Free tier gates exactly one action: sending an Invitation.** Inviting a Member requires the Board owner to be Pro at send time. Personal Board creation and all solo usage remain unlimited. No board-count caps anywhere (including at expiry).
- **Derived subscription state is computed lazily** from a `periodEnd` timestamp at read time (same pattern as Invitation expiry) — no cron/scheduler for correctness. States: no subscription, active, expired. There is intentionally **no grace period**.
- **Expiry behavior:** Boards *with Members* become read-only for everyone (view allowed, writes denied); the owner's Boards without Members remain fully writable under free tier. Never delete or hide data at expiry.
- **Expiry warning:** an in-app banner shown to the subscriber only when `periodEnd` is within 7 days; no warning email (no scheduling infrastructure).

### Payment lifecycle (state machine)

Two-stage submission lifecycle, guarded transitions modeled on `InvitationStatus`:

- `AWAITING_UPLOAD` — created when the user requests payment instructions; carries the unique payment reference, price/currency snapshot, and a 48-hour TTL. Auto-expires to `EXPIRED` when the TTL passes with no receipt. Shows bank details + reference + upload form.
- `PENDING` — set when the receipt is uploaded; enters the administrator queue. Only `PENDING` rows are visible to administrators.
- `APPROVED` — set by administrator action; starts the subscription clock.
- `REJECTED` — set by administrator action; **requires a non-empty reason**.
- `EXPIRED` — terminal, set by TTL.

Constraints: at most **one non-terminal (`AWAITING_UPLOAD` or `PENDING`) submission per user**, enforced inside a transaction. Status guards reject any transition from a terminal state (mirror of the Invitation guard).

### Money & subscription period

- **Rail: manual bank transfer.** No gateway, no webhooks.
- **Pricing configuration** lives in a single admin-editable settings record: price, currency, account holder, account number (validated 6–15 digits), bank name, transfer instructions. Seed values: **100 ETB** with placeholder bank fields.
- **Each submission snapshots price + currency at creation.** Administrators verify against the snapshot, never the live setting.
- **Payment reference = fast path, not a gate.** Verification order: reference match → fallback of amount + sender name + date. UI nudges compliance with a copy-chip reference and a memo-confirmation checkbox.
- **Subscription clock starts at approval** (one server-set timestamp). Period length = **one calendar month, clamped** (Jan 31 → Feb 28/29; never rolls into March).
- **Early renewal is allowed and stacked:** on approval, `periodEnd = max(now, currentPeriodEnd) + 1 month` when an active period exists, else `approval + 1 month`. This eliminates any locked gap between periods.
- The upgrade UI promises review **within 24 hours**; that promise is operationalized by the admin queue (below).

### Administration

- **Platform role:** a `role` field on the user model (enum: regular user, administrator; default regular). A `requireAdmin` session helper sits alongside the existing session helpers. The first administrator is promoted via a one-time script/direct database write; thereafter, administrators promote/demote others in-app.
- **Demotion guards**, enforced in a single transaction: an administrator cannot demote themselves, and cannot demote the last remaining administrator.
- **Review queue** at the protected admin route (added to the existing route-protection list): pending submissions oldest-first, aging badge ("Xh left" / "OVERDUE" past 24h), receipt viewer behind the same admin gate.
- **Administrator notification:** one best-effort email per newly `PENDING` submission (fire-and-forget; failure never fails the user's upload).

### Notifications

- Decision delivery uses **both** channels: an in-app `Notification` (new notification-type values for payment approved / payment rejected) **and** an email, sent best-effort so email failure cannot fail the mutation.
- Per **ADR-0002**, payment events are **never** written to Board Activity logs (they are not board-collaboration events); they exist as user Notifications plus permanent submission metadata.

### Receipt storage & upload

- Receipt **bytes stored in PostgreSQL** as a binary column on the submission (no new storage service). Uploaded via an **API route handler** (not a server action) to avoid framework body-size limits.
- Validation: real MIME/signature check accepting `image/jpeg`, `image/png`, `image/webp`, `application/pdf` — never filename extension; **5 MB max**, rejected before touching the database.
- **Retention:** receipt bytes deleted 30 days after the decision (approved or rejected); submission metadata kept permanently as the financial audit trail. Deleting bytes never deletes the submission row.

### Conventions (match existing codebase)

- Mutations are **Server Actions** returning the existing `ActionResult` discriminated union, with zod schemas and `revalidateTag`/query invalidation.
- Reads are **GET route handlers** consumed via TanStack React Query and a central query-key factory.
- Status feedback via `sonner` toasts through the existing toast helpers.
- New admin route added to the protected-route list in the proxy/middleware layer (cookie-existence check, as today).
- Schema changes additively: user role enum, settings record, payment submission model + status enum, new notification-type enum values — with accompanying schema tests.

## Testing Decisions

**What makes a good test:** assert only **external behavior** — the `ActionResult` returned by an action, the HTTP status/body of a route, the resulting database state, and the derived values of pure functions. Never assert on internal call sequences, private helpers, or implementation structure.

**Seams (all pre-existing families; no new test infrastructure):**

1. **Server Actions — primary seam.** Covers: subscription initiation (creates `AWAITING_UPLOAD` with reference + snapshot; blocked when a non-terminal submission exists; TTL → `EXPIRED`), admin approve (starts/stacks period; terminal-state guard; notification + email side effects), admin reject (requires reason; terminal-state guard), promote/demote (self-guard, last-admin guard, atomicity), and the Invitation action's new Pro gate (free user blocked, Pro allowed, lapsed owner blocked). Prior art: the existing server-action test suites (e.g. `actions/__tests__/notifications.test.ts`) — mock session + prisma, assert `ActionResult`.
2. **API route handlers — same family.** Covers: receipt upload (accepted MIME types, oversized rejection, invalid signature, unknown reference), admin queue GET (ordering, authz 403 for non-admins), receipt file GET (admin-only). Prior art: `app/api/**/__tests__/route.test.ts`.
3. **Pure library functions — supporting seam.** Calendar-month clamp incl. Jan-31 edge, stacked-renewal arithmetic, derived active/expired state from `periodEnd`, reference generation/uniqueness. Prior art: `lib/__tests__/invite-tokens.test.ts`.

Plus **schema tests** extending the existing suite for the new models, enums, and constraints (single non-terminal submission, snapshot fields, required rejection reason).

## Out of Scope

- Payment gateways, cards, webhooks, crypto, or any automated payment verification.
- Scheduled jobs of any kind (no cron for expiry-warning emails, no GitHub-Action schedulers) — lazily derived state only.
- Grace periods after expiry; dunning/win-back email campaigns.
- Team/Organization entities, per-Board purchases, seat-based or usage-based pricing, proration, refunds, taxes, invoices, promo codes, free trials, multiple tiers or currencies (single price/currency at a time).
- Hard paywalls on personal/solo usage; board-count limits.
- Better-auth admin plugin features (impersonation, bans); self-serve admin promotion UI for regular users.
- OCR or automated receipt amount extraction (review is human).
- Writing payment events to Board Activity logs (excluded by ADR-0002).
- Receipt storage in object storage (deferred; the schema should not preclude a later nullable URL column).
- Automatic data-export inclusion of receipt bytes (metadata may appear in exports later; bytes should not).

## Further Notes

- **Glossary gap:** `CONTEXT.md` does not yet define **Subscription, Subscriber, Payment submission, Receipt, Payment reference, Administrator (platform role)**. The glossary explicitly avoids "admin" for *board* roles (Owner) — the platform Administrator is a distinct concept and must be named carefully to avoid collision. Flag for `/domain-modeling`.
- **ADRs respected:** ADR-0002 (Activity log = collaboration feed) — payment events excluded from Activity; ADR-0001 (comments hard delete) — unaffected.
- **The 24-hour promise is operational, not just UI copy:** it depends on the administrator email + aging queue shipping together with the approval flow. Do not ship the promise without them.
- **Suggested build order:** schema + role/settings/migration → `requireAdmin` + guards → entitlement/date pure functions + tests → server actions + tests → upload route handler → user UI (upgrade/status/history/banner) → admin queue UI → notification emails.
- The existing TRD's open question about Vercel Cron (invitation cleanup) is unrelated to this spec and remains open.
