---
target: landing
total_score: 23
max_score: 32
na_heuristics: 9,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\DELL\\Documents\\MyCode\\all_projects\\myHobbyProjects\\collaborative-todo-app-1\\app\\(marketing)\\page.tsx"
target_fingerprint: "sha256:84dbf2592ebb0580cba4911529e96b7bd15b7a7961216ce9bbae143f29c755ce"
target_path: "C:\\Users\\DELL\\Documents\\MyCode\\all_projects\\myHobbyProjects\\collaborative-todo-app-1\\app\\(marketing)\\page.tsx"
timestamp: 2026-09-30T06-39-12Z
slug: app-marketing-page-tsx
closed: true
---
# Critique: Landing page — `app/(marketing)/page.tsx`

⚠️ DEGRADED: single-context (no sub-agent tool exposed).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Focus/hover feedback present; no active-section cue while scrolling (header is `position: static` — nav vanishes once you leave the top) |
| 2 | Match System / Real World | 3 | Plain language, honest ETB + bank-transfer copy; but "Kanban" reads as the generic noun, and "merge conflicts", "mentions", "inbox" don't match the actual product |
| 3 | User Control and Freedom | 3 | Anchor jumps and clear exits everywhere; nothing traps — but nothing to control either |
| 4 | Consistency and Standards | 3 | Cohesive card system; undermined by one "Get started" label doing five different jobs, pixel-identical Free/Pro cards, and a brand string that isn't the product's name |
| 5 | Error Prevention | 3 | FAQ preempts payment anxiety; "No bank details are shown here" prevents the predictable question; no forms to guard |
| 6 | Recognition Rather Than Recall | 3 | Labels are clear; but mobile users get zero section nav (measured `0×0`) and no scroll position cue |
| 7 | Flexibility and Efficiency | 2 | Anchor links are the only accelerator on the page; FAQ isn't collapsible; on 390px it's pure linear scroll |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, uncluttered — but monotone: five sections share one centered-heading + card-grid template; hierarchy carried by font-size alone |
| 9 | Error Recovery | n/a | Static surface — no user operation can fail here |
| 10 | Help and Documentation | n/a | Persuade surface; the FAQ is sales copy, not product help |
| **Total** | | **23/32** | **Good (71.9%)** |

Applicable maximum: 32 (heuristics 9 and 10 scored n/a).

## Design Specificity Verdict

**LLM assessment:** One element on this page is authored for this product and no other: the hero's CSS mini-board — real columns, live counts, Urgent/Done badges, built from the app's own tokens, correctly `aria-hidden`. Everything around it is the default SaaS landing grammar: "Plan, track, and ship together" → 3 steps → 6 feature cards → 2 pricing cards → FAQ → repeated final CTA. Swap the copy and this page ships unchanged for a CRM, a standup bot, or a design tool. The product's actual mechanism — deliberate subtraction: fixed three columns, exactly one owner, zero configuration, refusing custom workflows — is stated nowhere. The competitive anti-reference (Jira/Asana density) is never named. The page isn't even named after the product: header, footer, hero body, OG metadata and © line all say "Kanban" while PRODUCT.md confirms the name is Kanify. Biggest missed opportunity: the honest-bank-transfer story, the one thing neighboring products literally cannot copy, is a 12px footnote.

**Deterministic scan:** CLI `detect --json` on `app\(marketing)` returned clean (0 findings, exit 0). The browser detector (detect.js injected in-page) found 13 anti-patterns:

- low-contrast ×2 — 4.3:1 (need 4.5:1), #737373 on light: the "For teams" pill and the mini-board "feature" tag.
- line-length ×5 — ~110–128 chars/line (aim <80): the bank-transfer footnote and all four FAQ answers.
- em-dash-overuse ×1 — 11 em-dashes in body text.
- nested-cards ×5 — cards inside the preview's column cards. Likely false positive: deliberate, `aria-hidden` product mock.
- layout-transition ×1 — `transition: height`, page-level, no box in the overlay; locate before treating as real.

Detector-caught issues the review missed: exact contrast ratios and the line-length failures. Review-only findings the detector cannot see: stale brand, claim/truth gaps, five identical CTAs.

**Visual overlays:** Injection succeeded and the detector ran in the page (evidence: `C:\Users\DELL\AppData\Local\Temp\opencode\landing-overlay.png`). Headed presentation crashed on this machine (`ChildProcess.kill` on every `--headed` attempt), so no user-visible overlay tab was presented; the screenshot is the fallback evidence.

## Overall Impression

A competent, clean, honestly-priced page with one genuinely authored moment (the mini-board) submerged in stock SaaS template. It informs; it never argues. The single biggest opportunity: make the page sell the subtraction — fixed board, one owner, zero config, bank transfer — instead of listing six features any competitor also has.

## What's Working

1. The hero board preview. Real product vocabulary (column counts, Urgent/feature/✓ Done badges), token-driven, decorative-but-accurate, `aria-hidden`. The one element a competitor couldn't copy.
2. The money section told straight. Price read live from the DB (100 ETB), "No bank details are shown here", FAQ answering payment, team-cost, and expiry-read-only anxieties in plain words. High-stakes honesty, done right.
3. Session-aware CTAs that actually branch. Verified in-page: all five signed-out CTAs route to `/sign-up`; source confirms signed-in → `/boards` / `/upgrade`. No dead ends, no ghost states.

## Priority Issues

**[P1] Category-interchangeable composition.**
Why it matters: A visitor (or competitor) can't tell what this product believes. The mechanism PRODUCT.md calls non-copyable — deliberate subtraction — never appears; the hero could belong to any team tool.
Fix: Rebuild the hero around the stance ("A board that refuses to be configured"), make the mini-board the visual lead at larger scale showing the fixed three columns, and replace ≥2 of the six interchangeable feature cards with the subtraction argument.
Suggested command: `/impeccable bolder` (or `/impeccable shape` for a structural rethink)

**[P1] Copy promises the product doesn't keep + stale brand.**
Why it matters: "land in your inbox and your bell" (email is transactional-only; notifications are in-app), "mentions" (not in scope), "Roles and permissions keep the right people in control" (single owner + member), "real-time … no merge conflicts" (8s polling, last-write-wins documented). A coordinator who expects email digests churns at first login — and every surface still says "Kanban" instead of Kanify.
Fix: Rewrite those three blurbs to shipped truth; replace the brand string everywhere (header, footer, hero body, OG metadata, © line) with Kanify.
Suggested command: `/impeccable clarify`

**[P1] Accessibility: contrast and focus fail WCAG.**
Why it matters: Detector measured 4.3:1 (need 4.5:1) on small muted text — and #737373 muted body copy is used site-wide. The focus ring is 3px at 50% opacity of focus-gray ≈ 1.4:1 against white — far below the 3:1 needed to see keyboard position.
Fix: Darken muted-foreground for small text/pills (or darken pill backgrounds), and make the focus ring a solid ≥3:1 color.
Suggested command: `/impeccable audit`

**[P2] Pricing hierarchy and CTA duplication.**
Why it matters: Free and Pro are pixel-identical; Pro's only differentiator is a muted pill that is itself a contrast failure. Both cards' signed-out buttons say "Get started" — the Pro card's button drops intent at the exact moment of decision. Equal cards make Free the default.
Fix: Give Pro one accent (the system's reserved Signal Blue) or a stronger ring; relabel Pro's CTA "Get Pro"; promote the bank-transfer note out of 12px footnote size into a visible reassurance line.
Suggested command: `/impeccable layout`

**[P2] Reading length, copy rhythm, and navigation on a long scroll.**
Why it matters: FAQ answers run 110–128 chars/line; 11 em-dashes; and on mobile the section nav is `display:none` (0×0) with a non-sticky header — so a 390px user scrolls the entire feature grid to reach pricing with no way to jump.
Fix: Cap FAQ answers at ~65–75 chars/line, cut em-dashes to ≤3, make the header sticky and give mobile a section jump (or collapse the FAQ).
Suggested command: `/impeccable typeset` (nav: `/impeccable adapt`)

## Persona Red Flags

**Jordan (First-Timer):**
- Brand reads "Kanban" — a word they already use generically — so the product is never named; no recall, and it looks like a template.
- "no merge conflicts" is jargon to a non-technical coordinator; there is no help link, contact, or glossary anywhere on the page.
- Four permanently-expanded FAQ answers read as a wall of text instead of "your exact worry, answered."

**Riley (Stress Tester):**
- Five identical "Get started" buttons all land on `/sign-up` — click the Pro card expecting an upgrade flow, get a generic sign-up with zero plan context. Promise/result mismatch.
- Claims-check on first login: "mentions", "inbox notifications", "roles and permissions" don't exist → trust breaks immediately.
- Share-link check: OG title still says "Kanban — Collaborative todo app" with no image — the product misrepresents itself before the page even loads.

**Casey (Distracted Mobile):**
- Section nav hidden (measured `0×0`) + static header = pricing is ~1,500px of thumb-scroll away, no sticky CTA.
- Header buttons measure 87×28 and 62×28 — they pass WCAG 2.2's 24px floor but fall short of 44px thumb guidance; brand link is 48×20.
- The hero mini-board squeezes three columns into 390px at 10–11px text (the same tag flagged at 4.3:1) — the page's one authored moment dies on the device most of the audience will use.

## Minor Observations

- The dark "N" circle in screenshots is the Next.js dev-tools badge, not shipped UI.
- 8.4s TTFB was a dev-server cold compile — not a real perf signal.
- No `og:image` exists; PRODUCT.md forbids inventing brand assets — leave it absent, don't fabricate one.
- `text-[10px]` badges in the preview are too small even as decoration.
- "Real-time" against a documented 8s polling loop — "updates within seconds" is the honest phrase.

## Questions to Consider

- What would this page look like if it argued "and nothing more" instead of listing features?
- If a competitor could ship this page unchanged except the logo, what on it is actually yours?
- Does the pricing section earn trust at the moment money changes hands, or does it just display a number?
- Why should a visitor believe "real-time" from a product that polls every 8 seconds — what should the page show them instead?
