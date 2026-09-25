# 05 — Notifications core: assignment + bell

**What to build:** When a Member assigns a Todo to someone, the assignee gets a targeted **Notification**. On every authed app page, a global nav **bell** shows the **unread count** (Notifications with no `readAt`); opening it lists the latest 20 newest-first; clicking one navigates to that Todo (board + side panel focus) and marks it read; **mark all as read** resets the badge. Unread refreshes on the same 8-second poll cadence as todos while signed in. No email, no broadcasts, no other event types — targeted-only per the designed matrix.

**Blocked by:** 01 — Post-launch schema

**Status:** done

- [x] Assigning a Todo to a user persists a Notification row typed for assignment, addressed to that user only (self-assignment produces no row), atomically with the assignment write
- [x] Non-assignment events (status change, membership, tags, rename, comment — until ticket 06) persist no Notification rows
- [x] Global app-shell bell visible on authed pages; badge shows unread count and hides at zero; count is scoped to the acting user only
- [x] Bell opens a dropdown: latest 20 Notifications, newest first, progressive load beyond that (never full-list fetch)
- [x] Click-through navigates to the Notification's Todo with the side panel focused and sets `readAt` for that row
- [x] Mark-all-read server action clears only the acting user's unread rows in one call
- [x] Unread list/count polls on the same 8s cadence as todos while authenticated; mutations follow the two-cache invalidation rule
- [x] Notifications for a deleted board disappear (cascade); recipient account deletion erases their rows
- [x] No email/push is sent for any Notification (Resend stays transactional-only)
- [x] Server-entrypoint tests: assignment emission matrix (target user, self-assign none, bystanders none), mark-one/mark-all scoped to actor, unread-count contract, board-cascade behavior — external behavior only
