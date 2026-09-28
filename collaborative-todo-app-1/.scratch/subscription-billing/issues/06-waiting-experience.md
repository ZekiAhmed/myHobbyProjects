# 06 — Waiting experience

**What to build:** While a submission is under review, the subscriber sees their status everywhere and loses nothing: the upgrade screen swaps the pay CTA for a status card ("receipt submitted — awaiting review, within 24 hours"), a persistent banner appears on the dashboard, and a billing history page lists every attempt with status, timestamps, amount, and reference. Everything stays non-blocking — the user keeps using all free features normally. Team Members never see any of it.

**Blocked by:** 05 — Receipt upload → review queue.

**Status:** done

- [x] Upgrade screen renders the status card instead of the pay CTA while a PENDING submission exists
- [x] Dashboard banner shows the pending review (subscriber only, never Members)
- [x] Billing history page lists all submissions with status, timestamps, amount, and reference
- [x] All statuses shown include the 24-hour review promise copy
- [x] Reads go through GET route handlers + React Query with the central query-key factory
- [x] No navigation or free-feature behavior changes while pending
