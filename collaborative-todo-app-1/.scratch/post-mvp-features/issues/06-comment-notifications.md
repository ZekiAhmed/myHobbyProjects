# 06 — Comment-triggered Notifications

**What to build:** A new Comment on a Todo notifies exactly the people who should return to that conversation: the Todo's **Assignee** and every **prior commenter** on that Todo — minus the comment's author, and minus duplicate/self rows. The Notification rides the existing bell surface from ticket 05 (badge, dropdown, click-through to the Todo, mark read). Comment *edits* notify no one. Status changes and other events still notify no one.

**Blocked by:** 02 — Todo Comment feed; 05 — Notifications core: assignment + bell

**Status:** ready-for-agent

- [ ] Creating a Comment persists `COMMENTED` Notifications for: todo assignee (if not the author) and each prior commenter on that todo (excluding the author; de-duplicated per recipient)
- [ ] Author never receives a Notification for their own comment; a sole-commenter replying to themselves creates no rows
- [ ] Comment edits/deletes emit no Notification rows (deletes still only affect Activity per ticket 03)
- [ ] Recipients see the rows immediately through the ticket-05 bell (badge count, dropdown entry, click-through opens that todo and marks read) with no new UI surface
- [ ] Same two-cache invalidation and no-email rule as ticket 05
- [ ] Server-entrypoint tests: recipient matrix (assignee, prior commenter, author-excluded, self-no-row, de-dupe), no emission on edit, integration with mark-read contract — external behavior only
