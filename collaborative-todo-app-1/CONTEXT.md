# Collaborative Kanban Todo App

A lightweight shared Kanban board for small work teams (3–15 people) — just enough structure to coordinate, nothing more.

## Language

### Boards & membership

**Board**:
The shared unit of collaboration containing todos, tags, and members.
_Avoid_: project, workspace, list

**Owner**:
The single user who created a board and holds irreversible control over it (rename, delete, invite/remove, manage tags).
_Avoid_: admin, co-owner, creator (after creation)

**Member**:
A non-owner user with full read/write access to a board's todos, but no control over board settings.
_Avoid_: collaborator, contributor, guest

**Invitation**:
A time-limited, token-based grant of membership to a board for a specific email address.
_Avoid_: invite (as a noun), access link

**Tag**:
A per-board label (name + color) that can be attached to any todo on that board.
_Avoid_: label, category

### Todos

**Todo**:
A single unit of work on a board, with a status, priority, optional due date, optional assignee, and drag order.
_Avoid_: task, card, issue, item

**Assignee**:
The member a todo is assigned to; a todo has zero or one assignee.
_Avoid_: owner (of a todo), responsible person

### Comments

**Comment**:
A plain-text, newline-preserving note from a board member on a single todo.
_Avoid_: message, post, reply, note

**Comment feed**:
The chronological (oldest-first), paginated list of comments on one todo.
_Avoid_: thread, conversation, history

**Comment author**:
The member who wrote a comment; may edit or delete it. The board Owner may also delete any comment. Deletion is permanent — removal events are recorded in the Activity log, not as tombstones.
_Avoid_: poster

### Activity

**Activity log**:
The per-board chronological record of collaboration-relevant events (membership, todo lifecycle, comment removal, tags, board rename). Visible to all board members; dies with its board.
_Avoid_: audit trail, history, changelog, feed (unqualified)

**Activity entry**:
One record in an Activity log: what happened, who did it, to which resource, when. The actor shows as "Former member" once their account is deleted; entries themselves are never removed for actor reasons.
_Avoid_: audit record, log line, event (unqualified)

**Activity feed**:
The newest-first, paginated view of a board's Activity log.
_Avoid_: timeline, stream

### Notifications

**Notification**:
A per-user record that a targeted event needs their attention (todo assigned to them, or a new comment on a todo they're assigned to or have commented on). Carries a `readAt` timestamp; null means unread.
_Avoid_: alert, ping, inbox item

**Unread count**:
The number of a user's Notifications with no `readAt` — surfaced as the global nav bell badge.
_Avoid_: badge count (as a domain term)

### Platform administration

**Administrator**:
A platform-wide role — independent of board membership — whose holder approves subscription payments and admits or releases other Administrators.
_Avoid_: admin (as a role), superuser, root, platform admin

### Account & privacy

**Active session**:
A non-expired Session belonging to a user, listed in their account Security tab with device, IP, and timestamps. The current session is flagged and not individually revocable.
_Avoid_: device, login, tab

**Data export**:
A synchronous JSON download of all personal data about one user (profile, memberships, authored content, notifications, actor-scoped activity), with authentication secrets redacted.
_Avoid_: backup, archive, GDPR file
