// @vitest-environment jsdom
/**
 * @fileoverview Read-only banner tests (subscription-billing issue 09)
 *
 * CONTRACT UNDER TEST (BoardLockBanner):
 * 1. A locked Board tells whoever is looking that it is read-only — the
 *    Board stays viewable, only writing is refused (spec §Renewal,
 *    expiry & read-only)
 * 2. The LAPSED OWNER gets a self-service renew prompt: a link into
 *    /upgrade, the screen that restores editing (story 32)
 * 3. A Member never sees the renew prompt — the Owner is the only one
 *    who can renew, so offering it to a Member would be a dead end
 * 4. A never-subscribed Owner (reason "none": Board gained Members
 *    without a Pro period) gets the same self-service path, worded as an
 *    upgrade rather than a renewal
 *
 * jsdom environment — prior art:
 * components/subscription/__tests__/PendingReviewBanner.test.tsx
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { BoardLockBanner } from '@/components/board/BoardLockBanner'

let container: HTMLDivElement
let root: Root | undefined

async function render(reason: 'expired' | 'none', isOwner: boolean) {
  root = createRoot(container)
  await act(async () => {
    root!.render(<BoardLockBanner reason={reason} isOwner={isOwner} />)
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
})

describe('BoardLockBanner — the Board stays visible and says why', () => {
  it('tells a lapsed Owner the Board is read-only and offers the renew path', async () => {
    await render('expired', true)

    const banner = container.querySelector('[role="status"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toMatch(/read-only/i)
    expect(banner!.textContent).toMatch(/expired/i)

    const renew = container.querySelector('a[href="/upgrade"]')
    expect(renew).not.toBeNull()
    expect(renew!.textContent).toMatch(/renew/i)
  })

  it('keeps the renew prompt off a Member — only the Owner can renew', async () => {
    await render('expired', false)

    const banner = container.querySelector('[role="status"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toMatch(/read-only/i)
    expect(container.querySelector('a[href="/upgrade"]')).toBeNull()
  })

  it('offers an upgrade (not a renewal) to a never-subscribed Owner whose Board gained Members', async () => {
    await render('none', true)

    const banner = container.querySelector('[role="status"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toMatch(/read-only/i)
    expect(banner!.textContent).toMatch(/Pro subscription/i)

    const upgrade = container.querySelector('a[href="/upgrade"]')
    expect(upgrade).not.toBeNull()
    expect(upgrade!.textContent).toMatch(/upgrade|pro/i)
  })

  it('tells a Member of a never-Pro Board it needs a Pro subscription, with no purchase prompt', async () => {
    await render('none', false)

    const banner = container.querySelector('[role="status"]')
    expect(banner).not.toBeNull()
    expect(banner!.textContent).toMatch(/Pro subscription/i)
    expect(container.querySelector('a[href="/upgrade"]')).toBeNull()
  })
})
