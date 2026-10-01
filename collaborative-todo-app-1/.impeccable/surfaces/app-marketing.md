---
version: 1
slug: "app-marketing"
primary_target: "app/(marketing)"
related_targets: []
---

# Marketing root — landing page

## Scope and mode

- **Surface:** public root `/` — `app/(marketing)/page.tsx` + `layout.tsx`, marketing-local styling/components confined to the route. **Mode: Persuade.**
- **Audience:** team coordinators on small Ethiopian teams (English UI) judging in seconds whether this shared board is worth a signup; returning signed-in users routed to their dashboard.
- **Action:** session-branched primary action (Get started → /sign-up · Sign in → /sign-in · Go to dashboard → /boards) at header, hero, pricing cards, final CTA, footer.
- **Proof:** working three-column board preview (synthetic demo cards, aria-hidden), live Pro price from the settings row (price + currency only), honest bank-transfer note, Free-vs-Pro boundaries.
- **Copy:** verbatim; only stale `Kanban` → `Kanify` (header logo, footer logo + ©, metadata title/description/openGraph, hero sub). No new claims.
- **Tests:** `__tests__/page.test.tsx` and `__tests__/layout.test.tsx` must still pass; assertion edits only where the Kanify swap or new markup requires, no weakened coverage.
- **Out of scope:** `app/(app)/*`, `app/(auth)/*`, `app/invite/*`, shared `components/ui/*` behavior, app tokens in `app/globals.css`, favicon/brand assets (none exist — do not invent).
- **Build path:** code-led (confirmed, no comps). **Unresolved decisions:** none.

## Direction contract

**THESIS.** Every shared-board SaaS page ships the same light screenshot hero; this one is a loom — the page is composed on a visible warp/weft grid, divided by luminous band rules, one glow — and it refuses the category's light hero, feature-card wall, and enterprise-PM chrome.

**OWN-WORLD.** Canvas `#0a0a0a`, panel `#161616`, ink `#f4f4f5`, one glow accent `#93c5fd`; hairline warp/weft grid under everything; luminous band-rule dividers between sections; flat panels with hairline borders, no resting shadows. Bricolage Grotesque carries display type at hero scale; Geist Mono carries micro-labels — kickers, course numerals, the sync readout, card tickets. Status trio only where product-truthful.

**STORY.** Scan → believe → act: hero (thesis + proof + action) → how-it-works as numbered climbing courses → features → pricing (live price + bank-transfer honesty) → FAQ → anchored final close. Header anchors and session branches persist throughout.

**FIRST VIEWPORT.** Near-black grid field edge to edge; mono kicker; oversized white headline set across the warp; supporting line; one primary CTA (plus the quiet secondary); the three-column board preview lit as the centerpiece carrying the mono sync readout; a band rule closes the fold.

**FORM.** Grounded candidate 6 of 7 (handwoven shemma/tibeb weave), direction-concept roll — seed key `9f82d986`, mode persuade, assigned index 6, locked without steer or re-roll. Carried raises: 8-second sync pulse, scale-as-rank numerals, mono origin tickets on cards, numbered courses, one primary action per viewport.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
