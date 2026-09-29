# 12 — Receipt byte retention (lazy pruning)

**What to build:** Receipt bytes are deleted 30 days after the decision (approved or rejected), while the submission's financial metadata — amount, reference, timestamps, reviewer, outcome — is kept permanently as the audit trail. Pruning is opportunistic/lazy (piggybacking on existing reads), because this project has no cron infrastructure by design. Deleting bytes never deletes or alters the submission row, and billing history remains fully readable after pruning.

**Blocked by:** 07 — Admin review queue & approve/reject.

**Status:** done

- [x] Receipt bytes are removed once a submission's decision is older than 30 days, triggered by ordinary reads (no scheduler)
- [x] Submission metadata rows survive untouched; billing history and admin history render fine post-prune
- [x] Pruning failures never break the reads that trigger them
- [x] Tests cover the 30-day boundary, metadata preservation, and failure isolation
