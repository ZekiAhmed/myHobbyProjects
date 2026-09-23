/**
 * @fileoverview Feedback loop for React duplicate key in MemberList
 *
 * SYMPTOM:
 *   Encountered two children with the same key, `3pALvn2zV77Fa1LLUrQ0g9yGCof4ctux`
 *   at components/settings/MemberList.tsx:96 (allMembers.map key={member.id})
 *
 * CONTRACT: buildMemberRows must return rows with unique ids for any
 * owner/members combination the settings page can produce — including
 * owner also present in members (ownership transfer leaves BoardMember row).
 */

import { describe, it, expect } from 'vitest'
import { buildMemberRows, type Member, type BoardMemberRow } from '@/components/settings/MemberList'

const OWNER: Member = {
  id: '3pALvn2zV77Fa1LLUrQ0g9yGCof4ctux',
  name: 'Owner',
  email: 'owner@test.dev',
  image: null,
}

const OTHER: Member = {
  id: 'user_other',
  name: 'Other',
  email: 'other@test.dev',
  image: null,
}

function row(user: Member): BoardMemberRow {
  return { userId: user.id, joinedAt: new Date('2026-01-01'), user: OTHER === user ? user : user }
}

describe('buildMemberRows — unique React keys', () => {
  it('owner only, no members: one row, unique id', () => {
    const rows = buildMemberRows(OWNER, [])
    expect(rows.map((r) => r.id)).toEqual([OWNER.id])
  })

  it('owner + distinct members: all ids unique', () => {
    const rows = buildMemberRows(OWNER, [row(OTHER)])
    const ids = rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(OWNER.id)
    expect(ids).toContain(OTHER.id)
  })

  it('owner ALSO in members (post-transfer): still unique ids — exact crash case', () => {
    // transferOwnership only flips Board.ownerId; new owner keeps BoardMember row
    const rows = buildMemberRows(OWNER, [row(OWNER), row(OTHER)])
    const ids = rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter((id) => id === OWNER.id)).toHaveLength(1)
    // owner badge stays on the owner row
    expect(rows.find((r) => r.id === OWNER.id)?.isOwner).toBe(true)
  })

  it('duplicate member rows for same user: collapsed to one', () => {
    const rows = buildMemberRows(OWNER, [row(OTHER), row(OTHER)])
    const ids = rows.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every row has a non-empty id (React key safety)', () => {
    const rows = buildMemberRows(OWNER, [row(OWNER), row(OTHER)])
    for (const r of rows) {
      expect(r.id).toBeTruthy()
    }
  })
})
