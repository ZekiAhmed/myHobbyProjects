# 01 — Full marketing landing page

**What to build:** The public landing at `/` ships from "minimal MVP hero" (the scope decision recorded in `docs/debugging/05-dashboard-route-move-root-landing.md`) to a section-complete single-page marketing landing. Sections, top → bottom: hero (session-branched CTA + a decorative CSS mini-board built from DESIGN.md column washes), how-it-works (3 steps), features (`#features`, 3 → 6 cards), pricing (`#pricing`, Free vs Pro with the **live price read from the settings singleton** — price/currency only; bank details never render publicly — plus the honest bank-transfer/approval footnote), FAQ (4 agreed questions, plain stacked list), final CTA. The marketing layout gains section-nav anchors and a session-aware header/footer (signed out → Sign in/Get started; signed in → Go to dashboard). Out of scope by decision: testimonials, extra routes, sitemap/robots/canonical/JSON-LD/OG image (no production domain exists), second font, decorative gradients, fake social links.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Landing page renders all agreed sections with `#how-it-works` / `#features` / `#pricing` anchors
- [x] Hero keeps the session-branched CTA (signed out → Get started/Sign in; signed in → Go to dashboard)
- [x] CSS mini-board preview is `aria-hidden`, built from DESIGN.md washes (Slate/Sky/Mint), zero image assets
- [x] Pro price renders live from `getPricingSettings()` (defaults to 100 ETB when the row is missing); bank details never reach the public HTML
- [x] Pricing copy: Free = unlimited personal boards, invites behind Pro; Pro covers all owned boards, members free; bank-transfer + admin-review footnote carries the canonical "within 24 hours" promise
- [x] FAQ ships Q1–Q4 only, stacked (no accordion JS), answers fact-verified against the subscription spec
- [x] Marketing layout is async/session-aware: header section-nav, session-branched auth CTAs, 3-column footer with `© {year} Kanban`
- [x] Colocated tests: `app/(marketing)/__tests__/page.test.tsx` + `layout.test.tsx` (branching, live price, fallback, anchor ids, bank-detail exclusion, footer year)
- [x] `npm run lint`, `npx tsc --noEmit`, `npm run test:run` green
- [x] Visual QA at desktop + mobile widths against DESIGN.md (Signal-Only, Flat-By-Default, neutral chrome)
- [x] PRD updated: shipped note (L142) and routes table row (L318) no longer say "minimal"

## Comments

- **Deliberately skipped domain-bound SEO** (sitemap/robots/canonical/JSON-LD/OG image) — no production URL exists anywhere in the repo, so every URL would be a placeholder. Revisit at deploy time.
- **`getPricingSettings()`'s "authenticated callers only" note** refers to not exposing the row via a Server Action; the landing reads it server-side and renders only `price`/`currency`, asserted by the test "bank details stay out of the public page".
