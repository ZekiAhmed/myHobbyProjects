# 02 — Pricing & bank-details settings

**What to build:** An Administrator can view and edit the single pricing/bank-details settings record from the admin area: price, currency, account holder, account number (validated 6–15 digits), bank name, and transfer instructions. Values persist and are the single source of truth that the upgrade screen will read. Seeds on first run: 100 ETB with placeholder bank fields. Regular users cannot read or write this record through any endpoint.

**Blocked by:** 01 — Platform Administrator role & gate.

**Status:** ready-for-agent

- [ ] Settings record exists in the schema with the fields above
- [ ] Admin settings form renders current values, validates inputs (including the 6–15 digit account number), and saves via a server action returning the standard result union
- [ ] Non-administrators are rejected from read and write paths
- [ ] First-run seed creates 100 ETB + placeholders when no record exists
- [ ] Tests cover validation failures, authorization, and the save round-trip
