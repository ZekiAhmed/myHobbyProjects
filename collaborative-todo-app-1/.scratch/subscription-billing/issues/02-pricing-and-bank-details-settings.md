# 02 — Pricing & bank-details settings

**What to build:** An Administrator can view and edit the single pricing/bank-details settings record from the admin area: price, currency, account holder, account number (validated 6–15 digits), bank name, and transfer instructions. Values persist and are the single source of truth that the upgrade screen will read. Seeds on first run: 100 ETB with placeholder bank fields. Regular users cannot read or write this record through any endpoint.

**Blocked by:** 01 — Platform Administrator role & gate.

**Status:** done

- [x] Settings record exists in the schema with the fields above
- [x] Admin settings form renders current values, validates inputs (including the 6–15 digit account number), and saves via a server action returning the standard result union
- [x] Non-administrators are rejected from read and write paths
- [x] First-run seed creates 100 ETB + placeholders when no record exists
- [x] Tests cover validation failures, authorization, and the save round-trip

## Comments

- **The seed is owned by a migration, not by rendering.** Seeding on
  first *read* would mean an INSERT during server-component render — a
  DB write in the render path (Next data-security rule). Migration
  `20260928000000_seed_pricing_settings` inserts the singleton row
  (100 ETB + placeholders, asserted by a schema test), and
  `getPricingSettings()` is a pure read: it returns the row, or the
  seed defaults *in memory* when the row is missing. If a row is ever
  deleted, the form still shows the seed values and saving re-creates
  it through the action's upsert — rendering never writes.
- **Price is an integer in whole currency units** — `price Int`
  (100 = 100 ETB), per the spec's seed wording. The form sends whatever
  was typed; one shared zod schema (client + action, cannot drift)
  rejects NaN with "Price must be a whole number", plus `.int()` and
  `.positive()`. `accountNumber` is a plain string column; the 6–15
  digit rule is app-level in that same schema.
- **Save feedback goes through the existing toast helpers**
  (`lib/toast.ts` `handleActionResult` / `handleMutationError`), per
  spec §Conventions; `router.refresh()` on success (prisma-driven
  dynamic page, no fetch-cache tag to invalidate — same decision as
  issue 01's RoleManager, so `revalidateTag` from TRD conventions has
  nothing to tag here; add a tag when the upgrade screen's cached
  query lands).
- **The admin gate is re-checked in the action** with a local 3-line
  `getSession` + `getPlatformRole` check rather than exporting
  `refuseUnlessAdministrator` from `actions/admin.ts` — a non-`async`
  export from a 'use server' file would become a callable endpoint.
  Defense in depth: the page gate renders the form, the action refuses
  a session that lost the role with an authorization ActionResult.
- **Authorization coverage:** regular users hit `forbidden()` before
  any settings read (page test), the action's non-admin path is
  asserted directly, and the read helper is server-only (documented
  "NOT a Server Action" so no endpoint ever exposes the record).
