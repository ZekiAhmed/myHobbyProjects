Done. Milestone 3 (Membership & Invitation System) is complete. Here's what was implemented:

Server Actions:

createInvitation(boardId, email) — owner-only, generates secure token, sends invite email
revokeInvitation(invitationId) — owner-only, cancels pending invitation
acceptInvitation(token) — resolves user from session, validates token, creates membership
removeMember(boardId, userId) — owner-only, removes member from board
leaveBoard(boardId) — member self-removal (owner cannot leave)
Route Handlers:

GET /api/invitations?boardId=... — returns pending invitations (owner-only)
GET /api/boards/[id] — returns board detail with members and tags
GET /api/invite/[token] — validates invitation token with rate limiting
Pages:

/invite/[token] — semi-public page using getOptionalSession(), handles all 4 branches (new user, existing unauthed, already signed in, invalid token)
Components:

MemberList — shows members with remove button (owner-only) and leave board button
InviteForm — email input with invite button, shows pending invitations with revoke
Security:

Tokens generated with crypto.randomBytes(32) (256-bit entropy)
48-hour expiry enforced server-side
Upstash rate limiting: 30 req/60s/IP on /invite/[token]
Trust boundary fix: acceptInvitation resolves user from session, not client parameter
