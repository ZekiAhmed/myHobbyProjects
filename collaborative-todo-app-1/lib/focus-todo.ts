/**
 * @fileoverview Focus handoff from the Notification bell to the open board
 *
 * Click-through navigates with `?todo=<id>`; KanbanBoard adjusts its side
 * panel during render from that deep link, which covers fresh loads and
 * cross-board jumps. A REPEAT click on the same Notification is an
 * identical URL — Next.js navigation is a no-op, so the deep link would
 * never refocus a panel the user closed. The bell therefore also emits this
 * window event while navigating, and a mounted KanbanBoard answers it.
 *
 * Pure module — no server-only imports — shared by bell (emitter) and
 * board (listener) so the channel name lives in exactly one place.
 */

/** Window event name carrying a Todo id (`event.detail`). */
export const FOCUS_TODO_EVENT = 'notification:focus-todo'

/** Ask the mounted board to focus its side panel on `todoId`. */
export function emitFocusTodo(todoId: string): void {
  window.dispatchEvent(new CustomEvent<string>(FOCUS_TODO_EVENT, { detail: todoId }))
}

/**
 * Subscribe to focus requests; returns the unsubscribe function. Callers
 * register from an effect (a browser event, so `setState` inside the
 * handler is legal) and re-register when their Todo list changes.
 */
export function onFocusTodo(handler: (todoId: string) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<string>).detail)
  window.addEventListener(FOCUS_TODO_EVENT, listener)
  return () => window.removeEventListener(FOCUS_TODO_EVENT, listener)
}
