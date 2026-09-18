Done. Here's a summary of what was implemented:

Commit: 477887e — feat: add responsive design for mobile usability (Issue #10)

Changes across 5 files:
KanbanBoard.tsx — Mobile header with back arrow, board name (truncated), settings icon (owner-only), and Add Todo button. On mobile, renders a stacked single-column list view grouped by status instead of the 3-column Kanban with DndContext. DndContext and DragOverlay are desktop-only.
KanbanColumn.tsx — Responsive width: w-full md:w-72 (full-width on mobile, fixed 288px on desktop).
TodoSidePanel.tsx — On mobile, renders a full-screen Dialog (h-[100dvh]). On desktop, renders the existing slide-in Sheet. Form content extracted into a shared variable to avoid duplication.
FilterBar.tsx — On mobile, collapsible toggle with SlidersHorizontal icon and active filter count badge. Desktop renders inline horizontal bar. Shared FilterControls sub-component eliminates code duplication.
DashboardClient.tsx — Responsive padding, heading size, and margins.
Verification:
TypeScript: clean (tsc --noEmit passes)
Tests: 9/9 pass
Code review: fixed duplicated code smell by extracting FilterControls
