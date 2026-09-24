'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys, commentFeedQueryOptions } from '@/lib/queries/board-keys'
import { createComment, updateComment, deleteComment } from '@/actions/comments'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { CommentWithAuthor } from '@/lib/types'

interface CommentFeedProps {
  boardId: string
  todoId: string
  /** Signed-in user — Edit appears only on their own Comments */
  currentUserId: string
  /** Board Owner — Delete appears on every Comment (ADR-0001) */
  isOwner: boolean
}

function formatCommentTime(createdAt: Date | string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Tolerance before `updatedAt > createdAt` counts as an edit.
 *
 * `createdAt` defaults to the database clock while Prisma writes `updatedAt`
 * from the app clock, so a freshly created Comment can carry a small
 * positive skew. Genuine edits are seconds-or-minutes later.
 */
const EDITED_SKEW_MS = 2_000

/**
 * Comment feed for one Todo — rendered inside the Todo side panel.
 *
 * Infinite pagination (20 per page): the first page holds the newest window,
 * and the "Load older" control at the top of the feed loads the previous
 * window of older comments. Pages are flattened oldest → newest before
 * rendering, and comment bodies keep their line breaks (`whitespace-pre-wrap`).
 *
 * Comment lifecycle (ADR-0001): authors Edit/Delete their own Comments; the
 * board Owner additionally sees Delete on every Comment (never Edit — the
 * Owner is not a co-author). Deleted Comments vanish outright, and an
 * "Edited" marker appears whenever `updatedAt` has moved past `createdAt`.
 *
 * Posting/editing/deleting follow the two-cache invalidation rule: the server
 * action revalidates the `comments` tag, and this client invalidates the
 * matching query key on success.
 */
export function CommentFeed({
  boardId,
  todoId,
  currentUserId,
  isOwner,
}: CommentFeedProps) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [bodyError, setBodyError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editError, setEditError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const feed = useInfiniteQuery(commentFeedQueryOptions(boardId, todoId))

  const invalidateFeed = () =>
    queryClient.invalidateQueries({ queryKey: boardKeys.comments(boardId, todoId) })

  const postMutation = useMutation({
    mutationFn: () => createComment({ todoId, body }),
    onSuccess: (result) => {
      if (result.success) {
        setBody('')
        setBodyError('')
        invalidateFeed()
        toast.success('Comment posted')
      } else if (result.error.type === 'validation') {
        setBodyError(result.error.message)
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to post comment')
    },
  })

  const editMutation = useMutation({
    mutationFn: (input: { commentId: string; body: string }) => updateComment(input),
    onSuccess: (result) => {
      if (result.success) {
        setEditingId(null)
        setEditBody('')
        setEditError('')
        invalidateFeed()
        toast.success('Comment updated')
      } else if (result.error.type === 'validation') {
        setEditError(result.error.message)
      } else {
        setEditingId(null)
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to update comment')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (result) => {
      setPendingDeleteId(null)
      if (result.success) {
        invalidateFeed()
        toast.success('Comment deleted')
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to delete comment')
    },
  })

  const startEditing = (comment: CommentWithAuthor) => {
    setEditingId(comment.id)
    setEditBody(comment.body)
    setEditError('')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditBody('')
    setEditError('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || postMutation.isPending) return
    postMutation.mutate()
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editBody.trim() || editMutation.isPending) return
    editMutation.mutate({ commentId: editingId, body: editBody })
  }

  // Pages arrive newest-window-first; reverse them for oldest → newest display.
  const comments: CommentWithAuthor[] = (feed.data?.pages ?? [])
    .slice()
    .reverse()
    .flatMap((page) => page.comments)

  return (
    <section className="flex flex-col gap-3 border-t p-4" aria-label="Comments">
      <h3 className="text-sm font-medium">Comments</h3>

      {feed.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => feed.fetchNextPage()}
          disabled={feed.isFetchingNextPage}
        >
          {feed.isFetchingNextPage ? (
            <>
              <Spinner /> Loading…
            </>
          ) : (
            'Load older'
          )}
        </Button>
      )}

      {feed.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading comments…</p>
      ) : feed.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load comments.</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => {
            const isAuthor = comment.author.id === currentUserId
            const canDelete = isAuthor || isOwner
            const isEdited =
              new Date(comment.updatedAt).getTime() -
                new Date(comment.createdAt).getTime() >
              EDITED_SKEW_MS

            return (
              <li key={comment.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{comment.author.name}</span>
                  <time
                    dateTime={new Date(comment.createdAt).toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatCommentTime(comment.createdAt)}
                  </time>
                </div>

                {editingId === comment.id ? (
                  <form onSubmit={handleEditSubmit} className="flex flex-col gap-2">
                    <Label htmlFor={`comment-edit-${comment.id}`} className="sr-only">
                      Edit comment
                    </Label>
                    <Textarea
                      id={`comment-edit-${comment.id}`}
                      value={editBody}
                      onChange={(e) => {
                        setEditBody(e.target.value)
                        if (editError) setEditError('')
                      }}
                      rows={3}
                      aria-invalid={!!editError}
                      aria-describedby={editError ? `comment-edit-error-${comment.id}` : undefined}
                    />
                    {editError && (
                      <p id={`comment-edit-error-${comment.id}`} className="text-sm text-destructive">
                        {editError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={editMutation.isPending || !editBody.trim()}
                      >
                        {editMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                        disabled={editMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
                    {isEdited && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Edited {formatCommentTime(comment.updatedAt)}
                      </p>
                    )}
                    {canDelete && (
                      <div className="mt-2 flex gap-2">
                        {isAuthor && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(comment)}
                            aria-label={`Edit comment by ${comment.author.name}`}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPendingDeleteId(comment.id)}
                          aria-label={`Delete comment by ${comment.author.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Label htmlFor={`comment-composer-${todoId}`}>Add a comment</Label>
        <Textarea
          id={`comment-composer-${todoId}`}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (bodyError) setBodyError('')
          }}
          placeholder="Write a comment… (Enter adds a new line)"
          rows={3}
          aria-invalid={!!bodyError}
          aria-describedby={bodyError ? `comment-error-${todoId}` : undefined}
        />
        {bodyError && (
          <p id={`comment-error-${todoId}`} className="text-sm text-destructive">
            {bodyError}
          </p>
        )}
        <Button type="submit" disabled={postMutation.isPending || !body.trim()}>
          {postMutation.isPending ? 'Posting…' : 'Post comment'}
        </Button>
      </form>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the comment. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              type="button"
              onClick={(e) => {
                // Keep the dialog open until the mutation settles — Radix
                // closes on click by default, which would hide the pending
                // state and any failure (toast-only) from the user.
                e.preventDefault()
                if (pendingDeleteId && !deleteMutation.isPending) {
                  deleteMutation.mutate(pendingDeleteId)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete comment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
