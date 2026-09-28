# 04 — Subscribe: payment instruction card

**What to build:** A free user clicks Subscribe on the upgrade screen and immediately receives payment instructions: the current price and currency (from settings), bank details, a unique payment reference with a copy-to-clipboard button, and clear "include this in the transfer memo" guidance. A submission record is created in AWAITING_UPLOAD with the reference, a price/currency snapshot, and a 48-hour TTL; if no receipt arrives it expires, and starting a new attempt is blocked while a non-terminal attempt exists. Expiring the stale record must never deadlock future attempts.

**Blocked by:** 02 — Pricing & bank-details settings, 03 — Subscription date & entitlement math.

**Status:** done

- [x] Upgrade screen shows live price/currency, bank details, and transfer instructions from settings
- [x] Subscribe action creates AWAITING_UPLOAD with reference, price snapshot, and 48h TTL in a transaction
- [x] Single non-terminal submission per user is enforced; the error surfaced is actionable
- [x] Copy-to-clipboard reference chip with the memo nudge copy
- [x] Stale AWAITING_UPLOAD records become EXPIRED (lazy), after which a new attempt succeeds
- [x] Tests cover initiation, duplicate blocking, snapshotting, and TTL expiry
