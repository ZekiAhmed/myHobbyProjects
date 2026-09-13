# 08 — Board Settings Page

**What to build:** Owner-only settings page with rename board, member management, tag management, transfer ownership, and delete board with confirmation. Settings gear icon only visible to owner.

**Blocked by:** 03, 07

**Status:** ready-for-agent

- [ ] `transferOwnership(boardId, newOwnerId)` Server Action — owner only, updates `board.ownerId`, old owner loses settings access, revalidates `board-detail` and `boards` tags
- [ ] `/boards/[id]/settings` page — owner-only, uses `getRequiredSession()` + ownership check
- [ ] Settings page layout — sections for: Rename, Members, Tags, Danger Zone
- [ ] Rename section — inline edit for board name, save button
- [ ] Members section — `MemberList` component (view all, remove button) + `InviteForm` component (invite by email, revoke pending)
- [ ] Tags section — `TagManager` component (create, delete)
- [ ] Danger Zone section — "Delete Board" button with confirmation dialog, redirects to `/` after deletion
- [ ] Transfer ownership section — dropdown of all members, "Transfer" button with confirmation dialog ("You will become a regular member and lose settings access")
- [ ] Settings gear icon — only rendered for board owner on the board detail page