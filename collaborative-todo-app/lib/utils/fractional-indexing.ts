// HOW DRAG-AND-DROP ORDERING WORKS HERE (read this before touching
// dnd-kit code in components/board/):
//
// Naive approach: store todos with an integer "position" (0, 1, 2, 3...).
// Problem: to move a card between position 1 and 2, you'd have to shift
// EVERY card after it by one — that's an expensive, multi-row write for a
// single drag, and it's a nightmare with concurrent users dragging at once.
//
// Fractional indexing approach: store an ORDER STRING per card, chosen so
// that alphabetically sorting the strings gives the correct order. To
// insert a card between two existing cards with keys "a0" and "a1", we
// generate a new key that sorts strictly between them — e.g. "a0V" — and
// ONLY that one row needs to be written. No other card's key changes.
//
// This file wraps the `fractional-indexing` npm package and adds guards for
// the edge cases the TDD explicitly calls out (see TDD §11 risks table):
// inserting at the very start of a column, the very end, and into an
// initially empty column.

import { generateKeyBetween } from 'fractional-indexing'

/**
 * Computes the order key for a card being moved to a specific position in
 * a column.
 *
 * @param prevOrder  The order key of the card currently just BEFORE the drop
 *                    position, or `null` if dropping at the very start of
 *                    the column.
 * @param nextOrder  The order key of the card currently just AFTER the drop
 *                    position, or `null` if dropping at the very end of
 *                    the column (or into an empty column).
 */
export function getOrderKeyForPosition(
  prevOrder: string | null,
  nextOrder: string | null
): string {
  // generateKeyBetween(a, b) generates a key that sorts between a and b.
  // Passing `null` for either side tells the library "there's no bound on
  // this side" — i.e. null as the first arg means "beginning of the list",
  // null as the second arg means "end of the list". Calling it with
  // (null, null) — an empty column — returns a sensible starting key.
  return generateKeyBetween(prevOrder, nextOrder)
}

/**
 * Given a column's todos already sorted by `order` ascending, and the index
 * where a dragged card is being dropped, returns the correct order key for
 * that new position. This is the function components/board/KanbanBoard.tsx
 * calls on every drag-end event.
 */
export function computeNewOrder(
  sortedTodos: { order: string }[],
  dropIndex: number
): string {
  const prev = dropIndex > 0 ? sortedTodos[dropIndex - 1]?.order ?? null : null
  const next = sortedTodos[dropIndex]?.order ?? null
  return getOrderKeyForPosition(prev, next)
}