'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { boardKeys, commentFeedQueryOptions } from '@/lib/queries/board-keys'
import { createComment } from '@/actions/comments'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import type { CommentWithAuthor } from '@/lib/types'

interface CommentFeedProps {
  boardId: string
  todoId: string
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
 * Comment feed for one Todo — rendered inside the Todo side panel.
 *
 * Infinite pagination (20 per page): the first page holds the newest window,
 * and the "Load older" control at the top of the feed loads the previous
 * window of older comments. Pages are flattened oldest → newest before
 * rendering, and comment bodies keep their line breaks (`whitespace-pre-wrap`).
 *
 * Posting follows the two-cache invalidation rule: the server action
 * revalidates the `comments` tag, and this client invalidates the matching
 * query key on success.
 */
export function CommentFeed({ boardId, todoId }: CommentFeedProps) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [bodyError, setBodyError] = useState('')

  const feed = useInfiniteQuery(commentFeedQueryOptions(boardId, todoId))

  const postMutation = useMutation({
    mutationFn: () => createComment({ todoId, body }),
    onSuccess: (result) => {
      if (result.success) {
        setBody('')
        setBodyError('')
        queryClient.invalidateQueries({ queryKey: boardKeys.comments(boardId, todoId) })
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || postMutation.isPending) return
    postMutation.mutate()
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
          {comments.map((comment) => (
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
              <p className="text-sm whitespace-pre-wrap break-words">{comment.body}</p>
            </li>
          ))}
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
    </section>
  )
}
