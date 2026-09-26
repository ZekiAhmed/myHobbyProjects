# Debug Journal 06: Missing `nativeButton={false}` on Base UI Button (Settings Export)

**Date:** 2026-09-26
**Severity:** Low — dev-only console error; removes native `<button>` semantics (a11y/forms) on one link-button
**Files affected:** `components/settings/AccountSettingsClient.tsx`, `components/settings/__tests__/AccountSettingsClient.test.tsx` (new), `package.json` / `pnpm-lock.yaml` (added `jsdom` devDependency)
**Related issue:** None (browser console on `/settings` during QA)

---

## Symptom

```
Base UI: A component that acts as a button expected a native <button> because the
`nativeButton` prop is true. Rendering a non-<button> removes native button semantics,
which can impact forms and accessibility. Use a real <button> in the `render` prop,
or set `nativeButton` to `false`.

    at Button (components/ui/button.tsx:49:5)
    at AccountSettingsClient (components/settings/AccountSettingsClient.tsx:62:13)
    at AccountSettingsPage (app/(app)/settings/page.tsx:7:10)
```

Code frame:

```tsx
> 62 | <Button variant="outline" render={<a href="/api/me/export" />}>
     |   Export my data
     | </Button>
```

This repo's `Button` wraps Base UI's `@base-ui/react` `Button` (not Radix shadcn — see
gotcha already recorded in `05-dashboard-route-move-root-landing.md`). Base UI defaults
`nativeButton: true`; passing `render={<a/>}` renders an `<a>`, and `useButton`'s dev-only
`useEffect` flags the mismatch.

---

## Phase 1–2: Feedback Loop & Reproduction

### Why not SSR / renderToStaticMarkup

Read `node_modules/@base-ui/react/internals/use-button/useButton.js` first: the warning
fires inside `React.useEffect`, **client-side only**. Server rendering never triggers it —
the loop must execute effects in a DOM.

### How the warning is logged (needed for the assertion)

Base UI's `error()` = `createLogOnce('error', 'Base UI')` (`@base-ui/utils/error.js`):
dev-only (`NODE_ENV !== 'production'`), emits `console.error("Base UI: …")` **once per
unique message per process**. Vitest sets `NODE_ENV=test` → dev branch active. Assertion
target: spy on `console.error`, filter for `expected a native`.

### Loop

New test `components/settings/__tests__/AccountSettingsClient.test.tsx`
(`// @vitest-environment jsdom` docblock — repo default env is `node`, do not change the
global config). Renders the **real** `AccountSettingsClient` via `react-dom/client` +
`act`, spies `console.error`, asserts the filtered array is empty.

```bash
pnpm vitest run components/settings/__tests__/AccountSettingsClient.test.tsx
```

Two environment iterations were needed before the assertion itself could go red:

| Run | Failure | Fix |
|---|---|---|
| 1 | `Error: invariant expected app router to be mounted` — `SignOutButton` calls `useRouter()` (`next/navigation`) | Mock `next/navigation` (`useRouter` → stub object, `usePathname` → `/settings`) |
| 2 | Assertion **RED — exact user symptom**, stack `button.tsx` ← `AccountSettingsClient` | — (loop complete) |

`next/link` also mocked to a plain `<a>` (same router-invariant class; keeps the render
tree faithful — the export control still renders an `<a href="/api/me/export">`).
`globalThis.IS_REACT_ACT_ENVIRONMENT = true` required for `act`.

### Red run (verbatim)

```
AssertionError: expected [ Array(1) ] to deeply equal []
+ ["Base UI: A component that acts as a button expected a native <button> …
+    at Button (…/components/ui/button.tsx:39:57)
+    at AccountSettingsClient (…/components/settings/AccountSettingsClient.tsx:154:56)"]
```

**Loop criteria:** red-capable (asserts the exact message), deterministic, ~3.6s,
agent-runnable, one command. Minimised to a single component render; the load-bearing
element is the export `Button` at line 62 (removing the button greens the loop).

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | `AccountSettingsClient.tsx:62` passes `render={<a/>}` without `nativeButton={false}`; Button defaults `nativeButton=true` | Adding the prop alone greens the loop | **Correct** |
| 2 | The shared `button.tsx` wrapper should infer `nativeButton` from the `render` prop — bug systemic, more call sites affected | Grep finds other `render={<a\|Link>}` sites missing the prop | Rejected as *cause* — all 20 other `render=` sites already pair correctly; kept as prevention idea |
| 3 | Base UI 1.8.0 upgrade introduced the warning against previously-working code | Other pages would warn too | Rejected — other pages pass the prop, only settings warned |

Proceeded with #1 (repo convention per `docs/debugging/05-…:162`: match the call-site
pattern, not the wrapper).

---

## Phase 4: Instrumentation

No `[DEBUG-…]` logs. The `console.error` spy *was* the instrument — the assertion filter
is the boundary probe distinguishing hypothesis #1 from #2/#3 (a wrapper-level or
version-level bug would have red'd on other call sites too; the static sweep proved it
didn't).

---

## Root Cause

**File:** `components/settings/AccountSettingsClient.tsx:62`

**Cause:** Every other link-rendering `Button` in the repo pairs `render={<Link/a/>}` with
`nativeButton={false}` (invite ×6, marketing ×5, auth ×2, `pagination.tsx:52` — verified
by side-by-side grep of all 21 `render={<…}` sites vs 14 code `nativeButton` pairings +
1 mention in journal 05). The
"Export my data" button was written without the prop, so Base UI kept its default
`nativeButton: true`, rendered `<a>`, and `useButton`'s dev effect logged the semantics
warning. TypeScript cannot catch this — the prop is optional.

---

## Fixes Applied

### Fix: `AccountSettingsClient.tsx:62`

```tsx
// Before
<Button variant="outline" render={<a href="/api/me/export" />}>
  Export my data
</Button>

// After
<Button variant="outline" render={<a href="/api/me/export" />} nativeButton={false}>
  Export my data
</Button>
```

### Regression test (written BEFORE the fix, red → green)

`components/settings/__tests__/AccountSettingsClient.test.tsx` — renders the real
component; fails if `console.error` ever again contains `expected a native`. Mocks
`next/navigation` + `next/link` only (router context does not exist in jsdom); the
Button, Tabs, PageShell, SignOutButton and the export control all render for real.

### Dependency

`jsdom` added as devDependency (repo test env was node-only; the warning is
`useEffect`-gated, so a DOM is mandatory for this class of bug).

---

## Verification

| Check | Result |
|---|---|
| Loop (was red) | 1/1 pass (green) |
| `pnpm test:run` (full suite) | 178/178 pass (17 files) |
| `pnpm lint` (eslint) | 0 errors, 0 warnings |
| `pnpm exec tsc --noEmit` | 0 errors |
| Sweep: all 21 `render={<…}` sites vs `nativeButton` pairing | only line 62 was unpaired — now fixed; reverse direction (prop `false` + real `<button>`) checked too: `pagination`/`alert-dialog`/`combobox`/`dialog` correct |
| `[DEBUG-…]` leftovers | none |

---

## Gotchas Encountered

| Gotcha | Detail | Prevention |
|---|---|---|
| SSR can't see this warning | It lives in `useEffect` inside `useButton` — `renderToStaticMarkup` loops stay green | Read the library source to find *where* the check runs before choosing the test seam |
| Base UI logs `console.error` **once per process** (`createLogOnce`) | If an earlier test in the same worker triggers it, a later test could false-green | Vitest isolates modules per test file (fresh worker) — safe for now; if tests are ever merged into one file, assert with a fresh unique message or reset the log-once state |
| `useRouter()` throws outside an app router | First loop run died with `invariant expected app router to be mounted` from `SignOutButton` | Mock `next/navigation` at the seam; do not skip rendering the real component to dodge it |
| `act` needs `IS_REACT_ACT_ENVIRONMENT` | React 19 refuses act without it | Set the global in `beforeEach`; declare `var IS_REACT_ACT_ENVIRONMENT` via `declare global` for tsc |
| Repo vitest env is `node` globally | Changing `vitest.config.ts` to jsdom would slow every server-code test | Per-file `// @vitest-environment jsdom` docblock |
| Two lint/tsc iterations on the new test | Unused `eslint-disable` directive; `globalThis` implicit-any | Run `tsc --noEmit` + `eslint` on test files, not just source |

---

## Post-Mortem

### What would have prevented this

1. **The prop is invisible** — `nativeButton` is optional, `render` accepts anything, and
   TS accepts both the correct and the broken call site. Nothing in the type system or the
   component API forces the pairing.
2. **The convention lives in 15 scattered call sites** (and one debugging journal), not
   in the wrapper — each new link-button is a fresh chance to omit it.
3. **The regression test locks the call site** (renders `AccountSettingsClient` itself),
   but no guard exists for the *next* file that grows a link-button.

### Architectural follow-up

Two candidates, in order of leverage:

1. **ESLint rule** (e.g. `no-restricted-syntax`/custom): flag `render={<a|Link…>}` on
   Base UI button-acting components without `nativeButton={false}` (and the inverse).
   Cheap, repo-wide, catches both directions.
2. **Wrapper inference** — `button.tsx` could default `nativeButton` from the `render`
   element's tag (`'a'`/Link → `false`), making the call site impossible to get wrong.
   Touches shared code, so needs a decision on explicit-vs-inferred overrides.

Hand off to `/improve-codebase-architecture` with: *“Base UI Button `render`/`nativeButton`
pairing — lint guard or wrapper inference.”*

---

## Cleanup

- No `[DEBUG-…]` instrumentation was ever added.
- Test file remains as the permanent regression loop.
- No throwaway scripts or prototypes.
- `jsdom` is the only dependency change; no source-file leftovers.
