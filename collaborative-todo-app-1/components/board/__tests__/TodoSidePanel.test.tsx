// @vitest-environment jsdom
/**
 * @fileoverview Read-only side panel tests (subscription-billing issue 09)
 *
 * CONTRACT UNDER TEST (TodoSidePanel, readOnly):
 * 1. On a locked Board the Todo is still fully viewable — title,
 *    description, status, priority, due date, assignee and tags all
 *    render (spec: data preserved, never deleted or hidden)
 * 2. Nothing in the panel can write: no create/update form, no Delete
 *    control (the Server Actions refuse anyway — the UI must not offer
 *    what the server will bounce)
 * 3. The comment feed is shown in read-only form (no composer)
 * 4. With readOnly off, the editable form is still there — the guard
 *    must not be the default
 *
 * jsdom environment — prior art:
 * components/subscription/__tests__/PendingReviewBanner.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

vi.mock('@/actions/todos', () => ({
  createTodo: vi.fn(),
  updateTodo: vi.fn(),
  deleteTodo: vi.fn(),
}))

vi.mock('@/components/board/CommentFeed', () => ({
  CommentFeed: (props: { readOnly?: boolean }) => (
    <div data-testid="comment-feed" data-readonly={String(!!props.readOnly)} />
  ),
}))

import { TodoSidePanel } from '@/components/board/TodoSidePanel'
import type { TodoWithRelations } from '@/lib/types'

const todo = {
  id: 'todo_1',
  boardId: 'board_1',
  title: 'Ship the entitlement lock',
  description: 'Read-only at expiry for Boards with Members.',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  dueDate: new Date('2026-10-15T00:00:00.000Z'),
  order: 'a0',
  assigneeId: 'user_a',
  assignee: { id: 'user_a', name: 'Ada Lovelace', image: null },
  tags: [
    { tag: { id: 'tag_1', name: 'billing', color: '#FF0000' } },
  ],
} as unknown as TodoWithRelations

let container: HTMLDivElement
let root: Root | undefined

async function render(readOnly: boolean) {
  root = createRoot(container)
  await act(async () => {
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <TodoSidePanel
          open
          onOpenChange={() => {}}
          boardId="board_1"
          todo={todo}
          members={[{ id: 'user_a', name: 'Ada Lovelace', email: 'a@t.dev', image: null }]}
          tags={[{ id: 'tag_1', name: 'billing', color: '#FF0000' }]}
          currentUserId="user_a"
          isOwner
          readOnly={readOnly}
        />
      </QueryClientProvider>
    )
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)

  // jsdom has no matchMedia (hooks/use-mobile) — report desktop so the
  // sheet branch renders.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  )
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
    root = undefined
  }
  container.remove()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

// Radix portals the Sheet to document.body, so assertions read the whole body.
const ui = () => document.body

describe('TodoSidePanel — a locked Board stays fully viewable', () => {
  it('renders the Todo details read-only: no form, no write controls', async () => {
    await render(true)

    const body = ui()
    expect(body.textContent).toContain('Ship the entitlement lock')
    expect(body.textContent).toContain('Read-only at expiry for Boards with Members.')
    expect(body.textContent).toContain('Ada Lovelace')
    expect(body.textContent).toContain('billing')

    expect(body.querySelector('form')).toBeNull()
    expect(body.textContent).not.toMatch(/Update|Create Todo|Delete Todo/)
  })

  it('shows the comment feed read-only (no composer)', async () => {
    await render(true)

    const feed = ui().querySelector('[data-testid="comment-feed"]')
    expect(feed).not.toBeNull()
    expect(feed!.getAttribute('data-readonly')).toBe('true')
  })
})

describe('TodoSidePanel — the editable form is still the default', () => {
  it('keeps create/update controls when the Board is writable', async () => {
    await render(false)

    const body = ui()
    expect(body.querySelector('form')).not.toBeNull()
    expect(body.textContent).toContain('Update')
    expect(body.querySelector('[data-testid="comment-feed"]')!.getAttribute('data-readonly')).toBe('false')
  })
})
