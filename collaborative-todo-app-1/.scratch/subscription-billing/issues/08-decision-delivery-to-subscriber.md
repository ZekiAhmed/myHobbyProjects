# 08 — Decision delivery to subscriber

**What to build:** The subscriber learns the outcome whether or not they are logged in: approval sends an in-app Notification and an email saying they can now invite their team; rejection sends both with the exact reason shown next to the submission in billing history, plus a "submit a new receipt" entry point that starts a fresh attempt. Notifications use the existing Notification model with new payment decision types (never Board Activity entries, per ADR-0002). Emails are fire-and-forget — an email failure never rolls back the decision.

**Blocked by:** 07 — Admin review queue & approve/reject.

**Status:** ready-for-agent

- [ ] Approval and rejection each create an in-app Notification (new types) for the subscriber
- [ ] Approval and rejection each send a best-effort email using the existing email service
- [ ] Rejection reason appears in billing history next to the submission
- [ ] Rejected state offers "submit a new receipt" which initiates a fresh attempt
- [ ] Notification types extend the existing enum; payment events never touch Board Activity logs
- [ ] Tests cover notification creation, reason rendering, resubmit entry point, and email-failure-does-not-fail behavior
