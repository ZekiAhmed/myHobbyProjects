---
name: Collaborative Kanban Todo App
description: A quiet shared-Kanban control room — neutral surfaces, blue only for action, color as status signal.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  surface: "oklch(1 0 0)"
  surface-muted: "oklch(0.97 0 0)"
  mist: "#f9fafb"
  muted-fg: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  ink: "oklch(0.205 0 0)"
  on-ink: "oklch(0.985 0 0)"
  action-blue: "#2563eb"
  action-blue-deep: "#1d4ed8"
  focus-blue: "#3b82f6"
  on-action: "#ffffff"
  destructive: "oklch(0.577 0.245 27.325)"
  status-amber: "#d97706"
  status-red: "#dc2626"
  status-green: "#16a34a"
  success-soft: "#dcfce7"
  error-surface: "#fef2f2"
  error-border: "#fecaca"
  error-ink: "#b91c1c"
  column-todo: "#f1f5f9"
  column-todo-border: "#e2e8f0"
  column-progress: "#eff6ff"
  column-progress-border: "#bfdbfe"
  column-done: "#f0fdf4"
  column-done-border: "#bbf7d0"
  avatar-wash: "#dbeafe"
  avatar-ink: "#2563eb"
typography:
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  micro:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-action:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.label}"
    height: "32px"
  button-action-hover:
    backgroundColor: "{colors.action-blue-deep}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    typography: "{typography.label}"
    height: "32px"
  button-ink-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.lg}"
    opacity: "0.8"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    typography: "{typography.label}"
    height: "32px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    typography: "{typography.body}"
    height: "32px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "16px"
    typography: "{typography.body}"
  chip-priority-urgent:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    typography: "{typography.micro}"
  chip-tag:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    typography: "{typography.micro}"
---

# Design System: Collaborative Kanban Todo App

## Overview

**Creative North Star: "The Quiet Control Room"**

This is a calm operations console for small teams: neutral paper surfaces do the heavy lifting, and color only fires for action, priority, and status. The mood is calm and utilitarian — unpretentious, efficient, built for scanning a board in seconds rather than admiring chrome. Depth comes from light tonal shifts and thin rings, not decoration; the interface recedes so todos, assignments, and movement lead.

The system is a hybrid of two observed layers that already coexist: a shadcn/ui base-nova neutral token layer (pure OKLCH grays, compact controls, ring-bordered cards) and a functional Tailwind palette layer used directly on feature screens (Signal Blue CTAs, status reds/ambers/greens, soft column washes). New screens should treat both as one vocabulary: chrome stays quiet; hue is earned by meaning.

The confirmed visual anti-reference is enterprise project-management chrome — Jira/Asana density, heavy borders, loud gradients, configuration-first surfaces. Product principle "and nothing more" is a visual principle here too: if an element isn't helping someone scan, act, or coordinate, it doesn't ship.

**Key Characteristics:**
- Neutral, near-monochrome chrome; hue reserved for action and status
- Compact controls (32px default button/input height) and dense 14px work text
- Flat at rest (ring borders); shadows only as feedback (hover, dialog, drag)
- Soft status washes on Kanban columns; pill badges for priority
- Single system sans — functional hierarchy, no display face

## Colors

The palette is neutral-first: paper whites and ink grays form every surface, with blue reserved for primary action and a tight status trio carrying meaning.

### Primary
- **Signal Blue** (`#2563eb`): The only action hue. Primary CTAs (auth submit, New Board), links, focus rings, and avatar initials. Its deep step (`#1d4ed8`) is hover; `#3b82f6` is the focus ring on raw form fields.
- **Ink** (`oklch(0.205 0 0)`): Near-black shadcn `primary` — used by the design-system default button and badge variant when a non-blue solid is needed. On-ink text is `oklch(0.985 0 0)`.

### Neutral
- **Paper White** (`oklch(1 0 0)`): Page background, cards, popovers, inputs.
- **Mist** (`#f9fafb`): Auth page outer wash (`bg-gray-50`).
- **Surface Muted** (`oklch(0.97 0 0)`): Secondary buttons, muted chips, count pills, card footer tint.
- **Muted Ink** (`oklch(0.556 0 0)`): Secondary text — counts, timestamps, placeholders, column metadata.
- **Hairline** (`oklch(0.922 0 0)`): Borders and dividers on tokens; raw inputs use gray-300 (`#d1d5db`).
- **Focus Gray** (`oklch(0.708 0 0)`): Token focus ring; raw forms use Focus Blue.

### Status & Semantic
- **Urgent Red** (`oklch(0.577 0.245 27.325)` / `#dc2626`): Destructive token, Urgent badge, overdue dates, Danger Zone accents.
- **Due Amber** (`#d97706`): Due-today text only.
- **Done Green** (`#16a34a`): Quick-complete active state and Done semantics; soft form sits on `#dcfce7`.
- **Error Wash** (`#fef2f2` bg, `#fecaca` border, `#b91c1c` text): Inline form error banners.

### Column Washes
- **To Do Slate** (`#f1f5f9` / border `#e2e8f0`): Default column.
- **Progress Sky** (`#eff6ff` / border `#bfdbfe`): In Progress column.
- **Done Mint** (`#f0fdf4` / border `#bbf7d0`): Done column.

### Named Rules
**The Signal-Only Rule.** Hue appears only for action, status, priority, or focus. Everything else — nav, structure, chrome — stays in the neutral stack. If a new color can't answer "what does this mean?", it doesn't belong.
**The Single-Action Rule.** Signal Blue is the sole primary-action color. Don't introduce green/amber/purple buttons for ordinary CTAs; green and amber are reserved for status meaning.

## Typography

**Display/Body Font:** system UI sans (system-ui, -apple-system, Segoe UI, Roboto — no webfont is loaded)
**Label/Mono Font:** mono token points at Geist Mono (`--font-geist-mono`) but is not wired to a loaded font; treat mono as unavailable until a font ships.

**Character:** Functional system sans — bold section titles over dense 14px work text. One family, weight and size do all the hierarchy work; no display face, no tracking tricks.

### Hierarchy
- **Title** (700, 1.5rem, scales to 1.875rem on md; line-height 1.25): Page headers — Dashboard, Board Settings, auth headings (often centered).
- **Headline** (600, 1.25rem, line-height 1.4): Section headers — "Boards I Own", settings group titles.
- **Card title** (500–700, 1.125rem): Board card names; column headers use 0.875rem semibold.
- **Body** (400, 0.875rem, line-height 1.5): Default work text, todo titles (medium), descriptions.
- **Label** (500, 0.875rem, line-height 1): Form labels, buttons, field labels.
- **Micro** (500, 0.75rem): Badges, chips, due dates, counts, uppercase meta labels.

### Named Rules
**The One-Family Rule.** Hierarchy is size and weight only (700 titles → 600 headlines → 500 labels → 400 body). Don't introduce a second family or decorative styling to make text "pop."

## Layout

Container-based flow: `container mx-auto` with responsive gutters (`px-4` → `md:px-6`) and vertical rhythm `py-4` → `md:py-8`. Dashboard board grids step 1 → 2 → 3 columns (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`, gap-4). Auth screens center a fixed card (`max-w-md`) on the Mist wash, full viewport height.

The Kanban board is a horizontal row of fixed-width columns (`w-72` / 288px from `md` up; full-width stacked on mobile) with `gap-2` card stacks inside `p-2` droppable bodies. Column headers are `p-3` with a bottom hairline. Density is tight and scannable: 8px gap between cards, 12–16px internal card padding, 32px default controls. Spacing rhythm leans on Tailwind's 4px grid with named steps 8 / 16 / 32.

Side panels (todo editor) and dialogs overlay from the edge/center without altering board layout underneath.

## Elevation & Depth

Flat at rest, shadow as feedback. Surfaces separate with hairline borders and `ring-1 ring-foreground/10` on cards; column identity comes from tonal washes, not elevation. Shadows appear only as state responses: hover lift on dashboard cards, dialog/popover presence, and drag feedback.

### Shadow Vocabulary
- **Rest** (no shadow): Cards, columns, inputs — separation via ring/border and tone.
- **Hover lift** (`box-shadow` ≈ Tailwind `shadow-md`): Clickable BoardCards and the auth panel container — "pick me up" affordance only on interactive chrome.
- **Drag lift** (`shadow-lg` source / `shadow-xl` overlay): Todo being dragged drops to 50% opacity with `shadow-lg`; the DragOverlay copy floats with `shadow-xl` and a 2° rotation.
- **Presence** (dialog/sheet defaults from the kit): Overlays that must clear the board behind them.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, drag, overlay presence) — never as permanent card styling.

## Shapes

Gently rounded utility geometry driven by one base radius (`--radius: 10px`). Controls (buttons, inputs) use 8–10px corners (`rounded-md`/`rounded-lg`); cards and panels use 14px (`rounded-xl`); badges, count pills, avatars, and quick-complete buttons are full pills (`rounded-full` / `rounded-4xl`); small tag chips use 6px (`rounded`). Borders are 1px hairlines; there is no double-border or heavy-outline language. Columns share the control radius (8–10px) with 1px status-tinted borders.

## Components

The kit is quiet and compact: 32px controls, semantic badge variants, ring-bordered cards — content leads, chrome stays back.

### Buttons
- **Shape:** Gently rounded (8px auth/raw `rounded-md`; 10px kit default `rounded-lg`). Default height 32px (`h-8`); xs 24px, sm 28px, lg 36px.
- **Primary (Action):** Solid Signal Blue (`#2563eb`) on white text, `py-2 px-4` on auth forms; hover deepens to `#1d4ed8`. Kit default is Ink solid (`oklch(0.205 0 0)`) with hover at 80% opacity.
- **Outline / Secondary / Ghost:** Paper background with hairline border (hover fills Muted); secondary fills `surface-muted`; ghost appears on hover only (expand Done, toolbar actions). Destructive kit variant is soft: 10% destructive wash with destructive text — not a solid red slab.
- **Focus:** 3px ring at 50% (token ring or destructive ring); raw forms use `focus:ring-2 focus:ring-blue-500`.
- **Active:** 1px translate-down; disabled at 50% opacity.

### Chips (badges & tags)
- **Priority:** Pill (`rounded-full`, h-5, 2×8px padding, 12px medium). Urgent = soft destructive wash + red text; High = Ink solid; Medium = Muted solid; Low = outline.
- **Tags:** 6px radius chip with owner-chosen color at 20% alpha background and full-strength color text (inline style from tag.color).
- **Counts:** Muted pill on column headers (`text-xs`, `bg-muted`, full radius).

### Cards / Containers
- **Corner Style:** 14px (`rounded-xl`).
- **Background:** Paper White on light pages; columns carry the status wash instead.
- **Shadow Strategy:** Flat-By-Default — `ring-1 ring-foreground/10`, no rest shadow; BoardCard adds `hover:shadow-md`.
- **Border:** Ring replaces a heavy border; footer strips use a top hairline over `bg-muted/50`.
- **Internal Padding:** 16px standard (12px on `size=sm`); TodoCard nests `p-3` with `space-y-2`.

### Inputs / Fields
- **Style:** 32px height, 8–10px radius, transparent/paper background, hairline border (`border-input` token or gray-300 on raw auth fields), 12px horizontal padding, 14–16px text (16px pre-md to avoid iOS zoom).
- **Labels:** Above field, 14px medium, gray-700/foreground, 4px gap.
- **Focus:** 3px ring at 50% token ring, or `ring-2` Focus Blue with border shift on raw forms.
- **Error / Disabled:** Error wash banner (`#fef2f2` / red border / red-700 text) above the form; invalid fields get destructive border + ring; disabled at 50% opacity with muted fill.
- **Focus rings on any control:** 3px ring-ring/50 (kit) or blue-500 (raw) — never remove the visible focus indicator.

### Navigation
- **App shell:** A persistent top nav — neutral paper bar with a bottom hairline: the "Kanban" wordmark linking home on the left; the signed-in user's email (muted, truncated) and an outline Sign out button on the right corner. Page headers sit below it: back + settings icon actions on the board; Dashboard title + New Board.
- **Links:** Signal Blue with hover deepen; footer prompts (sign-up swap) stay 14px neutral text + blue link.
- **Auth layout:** Centered single card on Mist — the whole "navigation" is text links under the form. The invite landing uses the same panel.

### Signature Component: Kanban Column
The three status columns are the product's face: fixed 288px width (stacked full-width on mobile), 8–10px radius, 1px status-tinted border on its wash background (Slate / Sky / Mint). Header row (`p-3`, bottom hairline) holds a 14px semibold title and a muted count pill. Droppable body (`p-2`, min-height 200px) stacks white ring-bordered todo cards at 8px gaps; empty state is a centered 14px muted line. Drop target highlights with `ring-2 ring-primary/50`. Done column collapses after 10 items behind a full-width ghost button.

## Do's and Don'ts

### Do:
- **Do** keep chrome neutral: paper surfaces, hairline borders, Ink/Muted text — let board content and status washes carry the color.
- **Do** use Signal Blue (`#2563eb`) for every primary action and link; deepen to `#1d4ed8` on hover.
- **Do** apply the column washes exactly: Slate To Do, Sky In Progress, Mint Done, each with its 1px matching border.
- **Do** keep controls compact (32px default height) and cards flat at rest (`ring-1`, no shadow).
- **Do** show shadows only as feedback: `shadow-md` hover on clickable cards, `shadow-lg`/`shadow-xl` during drag, overlay shadows on dialogs.
- **Do** mark urgency with the status trio: red overdue/Urgent, amber due-today, green complete — text and soft badges, not full-bleed fills.
- **Do** use pill shapes for badges, counts, and avatars; 8–10px corners for controls; 14px for cards.
- **Do** keep page titles bold at 24–30px and work text at 14px in the single system sans.

### Don't:
- **Don't** add decorative color — gradients, brand-tinted section backgrounds, colored nav bars — or repurpose green/amber/purple for non-status CTAs.
- **Don't** put permanent drop shadows on resting cards or columns; rest is flat by rule.
- **Don't** reintroduce enterprise-PM chrome: heavy borders, dense toolbar walls, or configuration-first surfaces (anti-reference: Jira/Asana).
- **Don't** introduce a second font family, display face, or uppercase-everything labeling scheme.
- **Don't** soften the compact density into large airy paddings (32px+ control heights, 24px card gaps) — the system stays scannable and tight.
- **Don't** stack multiple saturated colors in one card; a todo card may show one priority signal, status text colors, and owner-tag hues — nothing else.
