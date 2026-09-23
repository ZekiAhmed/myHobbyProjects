/**
 * @fileoverview Feedback loop for todos.filter TypeError
 *
 * BUG: GET /api/boards/[id]/todos returning non-2xx JSON (403/500 body)
 * was resolved as success data by todosQueryOptions().queryFn, so
 * KanbanBoard's (todos as TodoWithRelations[]).filter(...) threw
 * "todos.filter is not a function".
 *
 * CONTRACT UNDER TEST: queryFn must either resolve to an array of todos
 * or reject — never resolve a non-array object.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { todosQueryOptions, boardDetailQueryOptions } from '@/lib/queries/board-keys'

function mockFetchResponse(body: unknown, status: number) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

/** Invoke a queryFn with a dummy context (tests never use the context). */
async function callQueryFn<T>(
  fn: ((ctx: never) => T | Promise<T>) | undefined
): Promise<T> {
  return await fn!({} as never)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('todosQueryOptions queryFn — must never resolve non-array (crash precondition)', () => {
  it('resolves to an array on 200 with todo list', async () => {
    const todos = [{ id: 't1', title: 'x' }]
    vi.stubGlobal('fetch', mockFetchResponse(todos, 200))

    const result = await callQueryFn(todosQueryOptions('board1').queryFn)

    expect(Array.isArray(result)).toBe(true)
    expect(result).toEqual(todos)
  })

  it('rejects on 403 error body { error } — does NOT resolve the object (goes red on this bug)', async () => {
    const body = { error: 'Forbidden: You are not a member of this board' }
    vi.stubGlobal('fetch', mockFetchResponse(body, 403))

    const queryFn = todosQueryOptions('board1').queryFn

    // If this resolves, KanbanBoard does body.filter → TypeError.
    // Rejection keeps useQuery data undefined → default [] → no crash.
    await expect(callQueryFn(queryFn)).rejects.toThrow()
  })

  it('rejects on 500 error body — does NOT resolve the object', async () => {
    const body = { message: 'Failed to get session', code: 'FAILED_TO_GET_SESSION' }
    vi.stubGlobal('fetch', mockFetchResponse(body, 500))

    await expect(callQueryFn(todosQueryOptions('board1').queryFn)).rejects.toThrow()
  })

  it('rejects on 404 error body', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ error: 'Board not found' }, 404))

    await expect(callQueryFn(todosQueryOptions('board1').queryFn)).rejects.toThrow()
  })

  it('simulates KanbanBoard consumption: resolved value is always safe to .filter', async () => {
    // Exact call-site pattern from components/board/KanbanBoard.tsx:186
    const cases: Array<[unknown, number]> = [
      [[{ id: 'a' }], 200],
      [{ error: 'Forbidden' }, 403],
      [{ message: 'boom' }, 500],
    ]

    for (const [body, status] of cases) {
      vi.stubGlobal('fetch', mockFetchResponse(body, status))
      let data: unknown = undefined
      try {
        data = await callQueryFn(todosQueryOptions('b').queryFn)
      } catch {
        data = undefined // TanStack Query: failed query leaves data undefined
      }
      const todos = (data ?? []) as unknown[]
      expect(() => todos.filter(() => true)).not.toThrow()
    }
  })
})

describe('boardDetailQueryOptions queryFn — same non-ok pattern', () => {
  it('rejects on 403 error body instead of resolving it', async () => {
    vi.stubGlobal('fetch', mockFetchResponse({ error: 'Forbidden' }, 403))

    await expect(callQueryFn(boardDetailQueryOptions('b1').queryFn)).rejects.toThrow()
  })

  it('resolves board object on 200', async () => {
    const board = { id: 'b1', name: 'Dev' }
    vi.stubGlobal('fetch', mockFetchResponse(board, 200))

    await expect(callQueryFn(boardDetailQueryOptions('b1').queryFn)).resolves.toEqual(board)
  })
})
