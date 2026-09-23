# Debug Journal 04: React Duplicate Key in MemberList

**Date:** 2026-09-24
**Severity:** Medium — console error on board settings; unstable list identity
**Files affected:** `components/settings/MemberList.tsx`
**Related issue:** None (browser console during settings QA)

---

## Symptom

```
Encountered two children with the same key, `3pALvn2zV77Fa1LLUrQ0g9yGCof4ctux`.
Keys should be unique so that components maintain their identity across updates.
Non-unique keys may cause children to be duplicated and/or omitted — the behavior
is unsupported and could change in a future version.

    at div … at MemberList (components/settings/MemberList.tsx:95:21)
    at BoardSettingsClient (components/settings/BoardSettingsClient.tsx:254:11)
    at BoardSettingsPage (app/(app)/boards/[id]/settings/page.tsx:44:5)

Code frame:
> 96 |           <div
> 97 |             key={member.id}
```

The duplicated id is a **user cuid** — the same person appears twice in `allMembers`.

---

## Phase 1–2: Feedback Loop & Reproduction

### Seam

The crash is at `allMembers.map(… key={member.id})`. Row construction was inline in the
component:

```ts
const allMembers = [
  { ...owner, joinedAt: null, isOwner: true },
  ...members.map((m) => ({ ...m.user, joinedAt: m.joinedAt, isOwner: false })),
]
```

No test-friendly export yet. Extracted `buildMemberRows(owner, members)` **verbatim (still
buggy)** so the loop tests production logic, not a copy.

### Loop

`components/settings/__tests__/MemberList.test.ts` — assert `rows.map(r => r.id)` has
unique ids for every settings-page shape.

### First meaningful run (red on the symptom, not a missing symbol)

```
pnpm test:run "MemberList"
→ 2 failed | 3 passed

FAIL owner ALSO in members (post-transfer): expected Set size 2 to be 3
FAIL duplicate member rows for same user: expected Set size 2 to be 3
✓ owner only / distinct members / non-empty ids
```

**Exact symptom:** duplicate `member.id` → React duplicate-key warning.
Deterministic, ~2s. Minimised to: owner prepended + owner (or same user) still in
`members` → must collapse to one row.

*(A preliminary run failed with `buildMemberRows is not a function` — red on a missing
export, not the bug. Replaced by shipping the buggy extract first so the assertion itself
went red.)*

---

## Phase 3: Hypotheses

| # | Hypothesis | Prediction | Result |
|---|-----------|------------|--------|
| 1 | Owner also has a `BoardMember` row — `transferOwnership` only flips `Board.ownerId`; membership row stays | Filter/dedupe by id greens the post-transfer test | **Correct** |
| 2 | Duplicate rows for the same non-owner user (data anomaly) | Same id-dedupe greens the fourth test | Covered by same fix |
| 3 | Wrong/unstable key field | Code uses `key={member.id}`; loop asserts id uniqueness — cuids are stable | Rejected |

**Proceeded with #1+#2** via one id-dedupe (both predictions).

---

## Phase 4: Instrumentation

No `[DEBUG-...]` logs. The red vitest assertion (`Set size ≠ length`) was the signal.
Code read confirmed the construction order: owner first, then raw `members` with no
`seen` set.

---

## Root Cause

**File:** `components/settings/MemberList.tsx` — `allMembers` construction

**Cause:** UI model assumes **owner ∉ members** (creator path: `createBoard` sets
`ownerId` only, no `BoardMember` row). **`transferOwnership` breaks that invariant:**

```ts
// app/actions/boards.ts — transferOwnership only:
await prisma.board.update({
  where: { id: boardId },
  data: { ownerId: newOwnerId },  // new owner KEEPS BoardMember row
                                // old owner is NOT inserted as member
})
```

After transfer, `board.owner` and `board.members[]` both contain the new owner.
`[owner, …members]` yields two rows with the same `id` → React duplicate key at
`key={member.id}`.

Secondary: any duplicate `BoardMember` for the same `userId` would also red — same fix.

---

## Fixes Applied

### Fix: `buildMemberRows` dedupes by user id (owner wins)

```ts
// Before
export function buildMemberRows(owner: Member, members: BoardMember[]): MemberRow[] {
  return [
    { ...owner, joinedAt: null, isOwner: true },
    ...members.map((m) => ({ ...m.user, joinedAt: m.joinedAt, isOwner: false })),
  ]
}

// After
export function buildMemberRows(owner: Member, members: BoardMember[]): MemberRow[] {
  const ownerRow: MemberRow = { ...owner, joinedAt: null, isOwner: true }
  const seen = new Set<string>([owner.id])
  const memberRows: MemberRow[] = []
  for (const m of members) {
    if (seen.has(m.user.id)) continue
    seen.add(m.user.id)
    memberRows.push({ ...m.user, joinedAt: m.joinedAt, isOwner: false })
  }
  return [ownerRow, ...memberRows]
}
```

Component now calls `buildMemberRows(owner, members)` instead of inlining the array.
Types `Member` / `BoardMemberRow` exported for tests.

**UI is defensive** — does not require a data migration to stop the console error.

---

## Verification

| Check | Result |
|---|---|
| Loop (was 2 red) | 5/5 pass |
| Full suite | 34/34 |
| `tsc --noEmit` | 0 |
| `eslint` | 0 |
| `[DEBUG-…]` leftovers | none |

**Regression tests:** `components/settings/__tests__/MemberList.test.ts` — owner-in-members
(post-transfer), duplicate member rows, owner-only, distinct members, non-empty ids.

---

## Post-Mortem

### What would have prevented this

1. **Normalize membership on transfer** — either remove the new owner’s `BoardMember` row
   *or* treat owner-as-member as legal everywhere (including `createBoard`). The UI copy
   says the old owner “will become a regular member,” but the action does not insert a
   `BoardMember` for them — a **separate data bug** (old owner may lose access entirely
   after transfer; worth its own ticket).
2. **Single row-builder used by every members UI** (settings list, transfer dropdown,
   invite autocomplete) so dedupe cannot drift per call site.
3. **Invariant test at the action seam** — `transferOwnership` then read
   `owner ∪ members` → assert unique ids. UI dedupe is the safety net; DB shape is the
   source of truth.

### Architectural follow-up

Deduping at render is correct. The dual state (`ownerId` + lingering `BoardMember`) is a
modeling smell. Hand off to `/improve-codebase-architecture` with: *“membership
normalization: owner representation and transferOwnership transitions.”*

---

## Cleanup

No `[DEBUG-...]` instrumentation. Test file remains as the permanent regression loop.
No throwaway scripts.
