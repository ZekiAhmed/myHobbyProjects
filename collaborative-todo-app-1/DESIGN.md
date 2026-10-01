---
name: Kanify Marketing — The Woven Dark
description: Handwoven dark landing system — loom-grid ground, luminous band rules, one glow, mono labels of record.
colors:
  canvas: "#0a0a0a"
  panel: "#161616"
  panel-raised: "#1c1c1c"
  board-frame: "#0d0d0d"
  board-column: "#101010"
  board-card: "#1a1a1a"
  scroll-thumb: "#2a2a2a"
  scroll-thumb-hover: "#3f3f46"
  ink: "#f4f4f5"
  ink-muted: "#a1a1aa"
  glow: "#93c5fd"
  border-hairline: "rgb(244 244 245 / 0.12)"
  border-band: "rgb(244 244 245 / 0.1)"
  grid-thread: "rgb(244 244 245 / 0.035)"
  status-urgent: "#f87171"
  status-done: "#4ade80"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.5vw, 5.25rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  wordmark:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.625
  body-sm:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  mono-label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.12em"
  mono-micro:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.1em"
  mono-readout:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "normal"
  mono-numeral:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "36px"
    fontWeight: 300
    lineHeight: 1
  mono-price:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "48px"
    fontWeight: 500
    lineHeight: 1
rounded:
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-md: "24px"
  section: "80px"
  section-md: "112px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "rgb(244 244 245 / 0.8)"
    textColor: "{colors.canvas}"
  button-outline:
    backgroundColor: "rgb(244 244 245 / 0.05)"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "44px"
    padding: "0 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "28px"
    padding: "0 10px"
---

# Design System: Kanify Marketing — The Woven Dark

> Scope: the public marketing route (`app/(marketing)/`), whose visual world is
> scoped to a `.woven` wrapper with route-local tokens in `marketing.css`.
> Signed-in app surfaces keep their own tokens untouched.

## Overview

**Creative North Star: "The Woven Dark"**

This landing surface is a loom, not a showroom. Every shared-board SaaS page
ships the same light screenshot hero; this one is composed on a visible
warp/weft grid, divided by luminous band rules, and lit by exactly one glow.
The world borrows its logic from handwoven shemma cloth (the grounded form
candidate: weave index 6) — a dark field, hairline threads crossing at a fixed
pitch, cells of divided cloth instead of floating cards, and rank expressed by
scale rather than chrome. Its confirmed anti-reference is the category itself:
the light hero, the feature-card wall, and enterprise-PM chrome are all refused
on purpose.

Density is editorial-dark: a near-monochrome cloth of black steps and hairline
borders, with Geist Mono carrying the labels of record (navigation, readouts,
origin tickets, numerals) and Bricolage Grotesque carrying display and body at
one voice. Color is spent almost nowhere — the sky-blue glow marks sync,
focus, selection, and the Pro tier; red and green fire only where the product
is telling the truth. The page reads scan → believe → act: hero proof,
numbered how-it-works courses, divided-cloth features, honest pricing, FAQ,
anchored close.

**Key Characteristics:**

- Loom ground: near-black field under a hairline warp/weft grid (72px pitch), every section closed by a luminous band rule
- One glow accent; no second hue anywhere in the chrome
- Bricolage Grotesque for display and body; Geist Mono only as labels, numerals, and readouts
- Flat hairline panels — depth from the tonal ladder and 1px borders, never resting shadows
- Exactly one solid primary action per viewport; everything else is outline or ghost
- Status red/green only where product-truthful (Urgent, Done)

## Colors

The palette is a dark cloth: four black steps for surface, two inks for text,
hairline whites for thread, one sky-blue glow for light.

### Primary

- **Ink** (`#f4f4f5`): all primary text and — inverted — the fill of the one
  solid primary button (ink fill, canvas-colored label). The wordmark, every
  headline, and the primary CTA share this single value; the CTA reads as
  "woven light" against the field.

### Accent

- **Loom Glow** (`#93c5fd`): the system's only accent hue. It appears as the
  radial aura behind the hero board, the sync dot and countdown, the focus
  ring, text selection, hover states on wordmark/nav/links, the Pro card's
  border and badge, and the caret. Never a large fill.

### Neutral

- **Canvas** (`#0a0a0a`): the page field, header, footer, scrollbar track —
  everything sits on it.
- **Panel** (`#161616`): pricing cards and the final CTA panel — the one
  lifted tier of surface in the chrome.
- **Panel Raised** (`#1c1c1c`): muted/hover fills for quiet controls.
- **Board tones** (`#0d0d0d` frame, `#101010` column, `#1a1a1a` card): the
  three-step ladder inside the hero board preview.
- **Ink Muted** (`#a1a1aa`): secondary copy — descriptions, FAQ answers,
  footer text, mono micro-labels.
- **Hairline** (`rgb(244 244 245 / 0.12)`): every structural border — cells,
  cards, rows, header/footer rules. The band rule and header/footer use the
  lighter `rgb(244 244 245 / 0.1)`.
- **Grid Thread** (`rgb(244 244 245 / 0.035)`): the warp/weft grid lines —
  barely there, but the whole page is built on them.
- **Scrollbar tones** (`#2a2a2a` thumb, `#3f3f46` thumb hover, canvas track):
  the route's chrome-only scroll colors — two gray steps above the canvas,
  never used as content surfaces.

### Status

- **Urgent Red** (`#f87171`) and **Done Green** (`#4ade80`): used only inside
  the board preview on product-truthful states (the Urgent badge, the Done
  mark). Never decorative.

### Named Rules

**The One Glow Rule.** The sky-blue glow is the only accent hue in the world.
It marks sync, focus, selection, hover, and the Pro tier — nothing else. If a
second hue enters the chrome, the loom is broken.

**The Status-Trio-Only Rule.** Red and green fire only where the product is
telling the truth about a card's state. They never tint a section, a button,
or a background.

## Typography

**Display / Body Font:** Bricolage Grotesque (self-hosted variable, 200–800,
with system-ui fallback)
**Label / Mono Font:** Geist Mono (self-hosted variable, 100–900, with
ui-monospace fallback)

**Character:** one grotesque does everything from the 84px hero shout to body
prose; the mono is a thin instrument layer of labels, numerals, and readouts.
The pairing is workshop-technical: woven display type, machine-typed tickets.

### Hierarchy

- **Display** (800, clamp 40–84px, line-height 1.02, tracking -0.035em):
  the hero headline only, set across the warp, balanced to ~15 characters.
- **Wordmark** (800, 15px, tracking -0.025em): "Kanify" in header and footer —
  type only; no logo asset exists.
- **Section** (700, 30px → 36px at md, line-height 1.2, tracking -0.025em):
  section headings (How it works, Everything a small team needs, pricing, FAQ,
  final close).
- **Title** (600, 18px → 20px at md, line-height 1.4): course titles, feature
  titles, FAQ questions, pricing tier names.
- **Body** (400, 16px → 18px at md for the hero sub, line-height 1.625):
  hero supporting line, FAQ answers; lead paragraphs capped ~54ch.
- **Body Small** (400, 14px, line-height 1.625): feature descriptions, course
  descriptions, pricing lists, footer copy.
- **Mono Label** (400, 11px, tracking 0.12em, uppercase): labels of record —
  header nav anchors, footer column headings, © line. Variants: 0.14em on
  footer headings, 0.10–0.14em on board column titles and badges.
- **Mono Micro** (400/500, 9px → 10px at md, tracking 0.10–0.14em): the hero
  board's in-frame labels only — column titles, count pills, status badges,
  origin tickets, and the SYNC strip label (fixed 10px). Board-internal
  scale; never used outside the board preview.
- **Mono Readout** (500, 11px, tabular): the sync countdown, column count
  pills, price figures' unit labels.
- **Mono Numeral** (300, 36px → 60px at md, line-height 1, tabular): the
  numbered how-it-works course numerals at 40% ink.
- **Mono Price** (500, 48px, line-height 1, tabular): Free/Pro price figures.

### Named Rules

**The Mono Labels-of-Record Rule.** Geist Mono, uppercase, and tracked appears
only as labels, numerals, tickets, and readouts — never as body copy, never as
headlines. If text is prose, it is Bricolage; if text is a label of record, it
is mono.

**The Scale-as-Rank Rule.** The how-it-works sequence ranks by scale: one mono
numeral at 40% ink grows 36px → 60px and steps inward (0 / 40px / 80px) with
each course. No bullets, no icons, no color — size and indent carry the rank.

## Layout

- **Ground:** the whole route paints a 72px × 72px warp/weft grid (1px lines
  at the grid-thread alpha) on the canvas, centered from the top, edge to
  edge. Everything is composed *on* it.
- **Container:** centered, max-width 1152px (`max-w-6xl`), with 16px gutters
  (24px at md). Header and footer share the same container.
- **Rhythm:** sections run 80px vertical padding (112px at md). Every section
  boundary is a 9px luminous band rule — never bare whitespace.
- **Section order:** hero → courses → features → pricing → FAQ → final CTA,
  with in-page anchors (`#how-it-works`, `#features`, `#pricing`) reachable
  from header and footer.
- **First viewport:** the hero fills `calc(100svh - 6rem)`, centered content
  column (kicker line, display headline capped 15ch, supporting line, CTA
  pair), then the three-column board preview at max 1024px wide, closed by a
  band rule.
- **Courses:** full-width rows separated by hairline top borders (bottom
  border closes the list); each row is numeral + text block, indenting
  0 → 40px → 80px at md to read as a climb.
- **Features:** one border-collapsed grid — hairline top+left on the wrapper,
  right+bottom on each cell — 1 column mobile, 2 at sm (640px), 3 at lg
  (1024px). Cells are cloth divisions, not gaps-and-cards.
- **FAQ:** stacked rows; at md each row splits into a two-column
  `1fr / 1.6fr` question/answer grid.
- **Header/footer:** 56px header with hairline bottom; footer is a 3-column
  grid at md with a hairline-topped mono © row. Below md, header nav anchors
  collapse away — the footer carries them.
- **Motion:** entrance rises 20px over 0.7s with 0.07s staggers (hero);
  scroll reveals use view timelines (0.6s rise, 0.5s band stretch); the sync
  dot beats every 8s; demo cards glide 640ms on each phase. All easing is
  `cubic-bezier(0.16, 1, 0.3, 1)`. `prefers-reduced-motion` disables every
  animation and collapses transitions to 0.01ms.

### Named Rules

**The Loom Ground Rule.** The ground is the warp/weft grid and every section
boundary is a luminous band rule — never bare whitespace, never a plain
`<hr>`. New sections weave onto the grid; they don't float above it.

## Elevation & Depth

This system is flat by rule. There are no resting shadows anywhere — not on
cards, panels, buttons, or the header. Depth is conveyed three ways: the
tonal ladder (canvas → board frame → column → panel → card), 1px hairline
borders that catch the eye like thread, and a single radial glow behind the
hero board that reads as light falling on the cloth.

### Shadow Vocabulary

- **Rest:** none. Every surface is flat at rest (flat-by-rule).
- **Sync beat** (`box-shadow: 0 0 0 0 → 0 0 0 6px rgb(147 197 253 / 0.55 → 0)`,
  8s cycle): motion, not elevation — the sync dot's pulse ring only.
- **Focus** (`box-shadow: 0 0 0 3px rgb(147 197 253 / 0.5)`): the glow-colored
  focus ring on interactive elements.

### Named Rules

**The Flat-Loom Rule.** Surfaces are flat at rest. If something needs to feel
raised, raise its tone one rung on the ladder or give it a hairline — never a
drop shadow.

## Shapes

- **Radius ladder:** 8px — feature icon boxes and board cards; 10px —
  buttons, board columns; 14px — pricing cards and the hero board frame;
  18px — the final CTA panel; full pill — badges, count pills, the Pro tag.
- **Borders:** always 1px, always the hairline white-alpha. Border-collapsed
  grids (features, courses, FAQ) share single lines between cells — cloth
  divisions, never doubled seams.
- **Square where woven:** the band rule, feature cells, and course rows carry
  no radius at all — the loom's straight edge against the rounded panels.
- **Icons:** inline stroke SVG at 1.5px stroke, sized 20px inside a 36px
  rounded-md box; monochrome, inheriting current color.

## Components

### Named Rule

**The One-Primary-Per-Viewport Rule.** Exactly one solid ink button per
viewport; every other action is outline or ghost. The solidity of the primary
is the conversion path — spending it twice spends its meaning.

### Buttons

- **Shape:** 10px radius (`rounded-lg`).
- **Primary:** solid ink fill with canvas-colored label; 44px tall, 24px
  horizontal padding, 15px medium label — the one solid action per viewport
  (hero, final close, Pro card).
- **Hover / Focus:** primary eases to 80% ink; focus draws the 3px glow ring
  at 50%; active presses down 1px.
- **Outline:** hairline border on a faint ink wash (5% ink), ink label; used
  for the quiet secondary in the hero and secondary pricing actions. Hover
  deepens the wash.
- **Ghost:** transparent, ink label, hover to panel-raised; the quietest tier
  (header "Sign in").
- **Header sizes:** small controls at 28–32px with mono labels — the header
  wears the label-of-record face.

### Band Rule (signature)

The section divider: a 9px full-bleed strip with 10%-ink hairlines top and
bottom, a luminous horizontal gradient (transparent → glow at 45% → ink at
60% at center → glow → transparent) crossed by 1px weft ticks every 9px. It
animates in with a horizontal stretch on scroll. Always `aria-hidden`.

### Hero Board (signature)

The centerpiece proof: a 14px-radius frame on a radial glow aura, containing
a right-aligned mono sync readout strip (SYNC label, glow dot, tabular
countdown), then three 10px-radius columns (frame/column/card tonal ladder)
holding demo cards. Cards are 8px-radius, hairline-bordered, with an
11–12px title, optional status badge, and a mono origin ticket ("SN · Tue").
Decorative, `aria-hidden`; it never polls.

### Feature Cell

Square-cornered cell in the border-collapsed grid: 24–28px padding, hairline
right/bottom edges, a 36px rounded icon box (faint ink wash, hairline border,
muted ink stroke), a 16px semibold title, a 14px muted description. Hover
tints the cell 2.5% white and shifts the icon stroke to the glow.

### Pricing Card

14px-radius panel with 28px padding and a hairline border. Tier name (Title),
then the mono price at 48px tabular with a muted unit label, then a 14px
checklist; Free's excluded line drops to 80% muted with an ✗ mark (copy is
verbatim product truth). The Pro variant replaces its border with glow at 25%
and wears a mono pill badge (glow text on glow-at-10% fill, glow-at-30%
border, 10px, 0.1em tracking, uppercase). Each card's CTA spans full width.

### Course Row

Hairline-separated row, 32px vertical padding: mono numeral at 40% ink
(36px → 60px, light, tabular) on the left, title + description on the right
with a 10px baseline gap at md; rows step inward as they climb.

### Navigation (header + footer)

Wordmark in extrabold display type, glow on hover. Header anchors are mono
labels (11px, 0.12em, uppercase, muted ink, glow on hover), hidden below md.
Footer repeats them as 14px body links under mono uppercase column headings,
plus a mono 11px © row on a hairline.

## Do's and Don'ts

### Do:

- **Do** keep the loom ground: the 72px warp/weft grid under everything, and
  a luminous band rule between every section — never a section break by
  whitespace alone.
- **Do** allow exactly one solid primary button per viewport; make every
  other action outline or ghost.
- **Do** set labels of record — nav anchors, footer headings, sync readout,
  column titles, origin tickets, numerals — in Geist Mono, uppercase and
  tracked where they label.
- **Do** separate surfaces with 1px hairline borders and the tonal ladder
  (canvas → board-frame → column → panel → card); keep every resting surface
  flat.
- **Do** spend the glow only on sync, focus, selection, hover, and the Pro
  tier.
- **Do** mark status truthfully: Urgent red and Done green on card states
  only.
- **Do** rank the how-it-works courses with mono numerals scaled 36px → 60px
  and stepped indents.
- **Do** keep pricing copy verbatim, including the ✓/✗ list marks, the live
  price from the settings row, and the bank-transfer note.
- **Do** animate entrances on `cubic-bezier(0.16, 1, 0.3, 1)` and disable all
  of it under `prefers-reduced-motion`.

### Don't:

- **Don't** reintroduce the category's light hero, a floating feature-card
  wall, or enterprise-PM chrome — that is the confirmed anti-reference.
- **Don't** introduce a second accent hue, a gradient section background, or
  a large glow fill; one glow is the whole budget.
- **Don't** put a resting drop shadow on any surface — flat at rest, by rule.
- **Don't** use Geist Mono for body copy or headlines, or Bricolage for
  labels/readouts/numerals.
- **Don't** double borders in collapsed grids or round the band rule, feature
  cells, or course rows — the woven edges stay square.
- **Don't** invent a logo, wordmark graphic, or brand asset — the mark is
  type, and no asset exists.
- **Don't** add testimonials, logos-of-customers, or benchmark claims — none
  exist in the product.
