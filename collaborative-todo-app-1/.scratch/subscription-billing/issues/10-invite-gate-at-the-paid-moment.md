# 10 — Invite gate at the paid moment

**What to build:** Sending an Invitation to a Board requires the Board's Owner to be Pro, checked at send time. A free Owner who tries to invite sees the paywall prompt at exactly that moment — the single paid moment of the product — while their personal Boards stay unlimited and fully functional. A Pro Owner invites with no interruption, invited Members never encounter any paywall, and an expired Owner's attempt to invite gets the renew prompt instead. Accepting an Invitation is never gated.

**Blocked by:** 09 — Pro entitlement & expiry lock.

**Status:** done

- [x] Invitation send action checks the owner's entitlement and blocks free owners with a paywall response
- [x] The client surfaces the paywall/upgrade prompt at the invite moment (not before)
- [x] Pro owners send invitations normally; accepting an Invitation works for everyone regardless of the owner's state
- [x] Lapsed owners get the renew prompt, not a generic error
- [x] Tests cover free-blocked, Pro-allowed, expired-blocked, and member-acceptance paths
