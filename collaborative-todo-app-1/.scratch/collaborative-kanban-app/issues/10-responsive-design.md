# 10 — Responsive Design

**What to build:** Desktop-first with basic mobile usability. Full Kanban board with drag-and-drop on desktop. Simplified list view on mobile with no drag-and-drop, full-screen side panel, and quick-complete still working.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Desktop layout — 3-column Kanban board with drag-and-drop, side panel, all features
- [ ] Mobile layout — simplified list view of todos grouped by status, single column
- [ ] Disable drag-and-drop on mobile — detect touch device or viewport width, disable DndContext
- [ ] Mobile side panel — full-screen modal instead of slide-in panel
- [ ] Mobile quick-complete — ✓ button works on mobile (no drag required)
- [ ] Responsive breakpoints — Tailwind CSS v4 breakpoint utilities (`md:`, `lg:`)
- [ ] Mobile navigation — board name, back to dashboard, settings (owner only)
- [ ] Mobile filter bar — collapsible section instead of horizontal bar
- [ ] Board card on dashboard — responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)