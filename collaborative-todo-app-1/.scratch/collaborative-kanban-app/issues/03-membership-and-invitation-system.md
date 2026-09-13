# 03 — Membership & Invitation System

**What to build:** Complete invitation flow with all 4 branches (new user, existing unauthed, already signed in, invalid token). Invite by email, revoke pending invitations, remove members, leave board. Token-based with 48h expiry and rate limiting.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `createInvitation(boardId, email)` Server Action — owner only, generates `crypto.randomBytes(32).toString('hex')` token, creates Invitation record with 48h expiry, sends invite email via Resend, revalidates `board-detail` tag
- [ ] `revokeInvitation(invitationId)` Server Action — owner only, deletes Invitation record, revalidates `board-detail` tag
- [ ] `acceptInvitation(token)` Server Action — validates token, checks expiry, creates BoardMember record, marks Invitation as ACCEPTED, revalidates `board-detail` tag
- [ ] `removeMember(boardId, userId)` Server Action — owner only, deletes BoardMember record, revalidates `board-detail` tag
- [ ] `leaveBoard(boardId)` Server Action — member only (not owner), deletes own BoardMember record, revalidates `boards` tag
- [ ] `GET /api/invitations?boardId=...` Route Handler — returns pending invitations for a board (owner only)
- [ ] `boardDetailQueryOptions(id)` — TanStack Query options for fetching board detail + members + tags
- [ ] `/invite/[token]` page — semi-public page, uses `getOptionalSession()`, handles all 4 branches:
  - Branch A: new user → redirect to `/sign-up?inviteToken=[token]`
  - Branch B: existing user, not signed in → redirect to `/sign-in?inviteToken=[token]`
  - Branch C: already signed in → consume invitation immediately
  - Branch D: invalid/expired token → error page with message
- [ ] Sign-up page updated to handle `inviteToken` query param — consumes invitation after sign-up + email verification
- [ ] Sign-in page updated to handle `inviteToken` query param — consumes invitation after sign-in
- [ ] `MemberList` component — shows all members with remove button (owner only)
- [ ] `InviteForm` component — email input + invite button, shows pending invitations with revoke button
- [ ] Upstash Redis rate limiting on `/invite/[token]` (30 req / 60s / IP)