/**
 * @fileoverview Activity action vocabulary → the sentences the Activity feed renders
 *
 * `Activity.action` is a free string, not an enum, so the taxonomy can widen
 * without a migration (ADR-0002). This module is the single place that maps
 * those strings to user-facing text: the object literal is `satisfies
 * Record<ActivityAction, string>`, so every action the server can emit must
 * have a sentence here or the build fails.
 *
 * CLIENT-SAFE: no server-only imports — rendered by the Activity feed.
 *
 * @see docs/adr/0002-activity-log-user-feed-not-audit-trail.md
 * @see CONTEXT.md § Activity — Activity log / Activity entry / Activity feed
 */

/**
 * The fixed ADR-0002 taxonomy: board rename, membership changes, todo
 * lifecycle, comment create/delete, tag create/delete. Field-level edits and
 * reorders are deliberately absent and must never be added here.
 */
export type ActivityAction =
  | 'board.renamed'
  | 'member.invited'
  | 'member.joined'
  | 'member.removed'
  | 'member.left'
  | 'todo.created'
  | 'todo.deleted'
  | 'todo.status_changed'
  | 'todo.assignee_changed'
  | 'comment.created'
  | 'comment.deleted'
  | 'tag.created'
  | 'tag.deleted'

/**
 * Rendered after the actor's name: "Ada renamed the board".
 *
 * Kept as a verb phrase (not a full sentence) so the feed can style the actor
 * separately — including the designed "Former member" placeholder.
 */
const PHRASES = {
  'board.renamed': 'renamed the board',
  'member.invited': 'invited a member',
  'member.joined': 'joined the board',
  'member.removed': 'removed a member',
  'member.left': 'left the board',
  'todo.created': 'created a todo',
  'todo.deleted': 'deleted a todo',
  'todo.status_changed': 'changed a todo status',
  'todo.assignee_changed': 'changed a todo assignee',
  'comment.created': 'commented on a todo',
  'comment.deleted': 'deleted a comment',
  'tag.created': 'created a tag',
  'tag.deleted': 'deleted a tag',
} as const satisfies Record<ActivityAction, string>

/** Display name for the actor of an entry whose account was erased. */
export const FORMER_MEMBER = 'Former member'

/**
 * The verb phrase for an Activity action.
 *
 * The fallback keeps a widened taxonomy readable before this client learns the
 * new action — the feed never renders a blank entry.
 */
export function activityPhrase(action: string): string {
  const phrase = (PHRASES as Record<string, string | undefined>)[action]
  return phrase ?? 'performed an action'
}
