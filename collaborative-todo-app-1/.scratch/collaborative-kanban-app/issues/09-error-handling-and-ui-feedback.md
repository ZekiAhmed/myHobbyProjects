# 09 — Error Handling & UI Feedback

**What to build:** Hybrid error pattern (validation inline, authorization toast, network toast). Success toasts for invisible actions and slow operations. Loading states with button spinners and inline indicators.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Error response pattern — Server Actions return `{ success: false, type: 'validation'|'authorization'|'server', message: string }`
- [ ] Validation errors — inline error message below the field in forms (e.g., "Tag name already exists")
- [ ] Authorization errors — toast with specific message (e.g., "Only the board owner can delete the board")
- [ ] Network/server errors — generic toast with retry button ("Failed to save — try again")
- [ ] Success toasts — only for invisible actions (invite sent, email verified) and slow operations (>1 second)
- [ ] Loading states — button spinners during async operations, "Saving…" text in side panel
- [ ] `toast` utility — wraps sonner or similar toast library for consistent notification pattern
- [ ] Error boundary component — catches React rendering errors, shows fallback UI
- [ ] Auth error handling — session expired toast, redirect to sign-in