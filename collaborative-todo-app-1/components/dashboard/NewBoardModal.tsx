/**
 * @fileoverview New Board Modal Component
 *
 * This component renders a modal dialog for creating a new board.
 * It handles the entire create board flow:
 *   1. User clicks "New Board" button
 *   2. Modal opens with a form
 *   3. User enters a board name and submits
 *   4. Client-side validation (non-empty name)
 *   5. Server Action (createBoard) creates the board in the database
 *   6. On success: close modal, reset form, navigate to the new board
 *
 * STATE MANAGEMENT:
 * - open: Controls modal visibility (open/closed)
 * - name: The board name being typed (controlled input)
 * - createMutation: TanStack Query mutation for creating the board
 *
 * MUTATION PATTERN:
 * This component uses TanStack Query's useMutation for the create operation.
 * This provides:
 *   - Loading state (isPending) for the submit button
 *   - Error handling (onError) for failed mutations
 *   - Success handling (onSuccess) for post-creation logic
 *   - Automatic cache invalidation after success
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/mutations
 */

'use client' // Client Component — uses hooks, form handling, and client-side navigation

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createBoard } from '@/app/actions/boards'
import { boardKeys } from '@/lib/queries/board-keys'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * NewBoardModal — modal for creating a new board
 *
 * WHAT IT DOES:
 * - Renders a "New Board" button that opens a modal
 * - Provides a form to enter the board name
 * - Creates the board via Server Action
 * - Navigates to the new board on success
 *
 * @returns The modal component with trigger button
 */
export function NewBoardModal() {
  // Modal visibility state — controlled by the Dialog component
  const [open, setOpen] = useState(false)
  
  // Board name input — controlled by the form
  const [name, setName] = useState('')
  
  // Next.js router for client-side navigation after board creation
  const router = useRouter()
  
  // TanStack Query client for cache invalidation
  const queryClient = useQueryClient()

  /**
   * Mutation for creating a new board
   *
   * HOW IT WORKS:
   * - mutationFn: Calls the createBoard Server Action
   * - onSuccess: Runs after the server returns success
   *   - Invalidates the 'boards' cache so the dashboard refreshes
   *   - Closes the modal and resets the form
   *   - Navigates to the new board's page
   *
   * WHY INVALIDATE QUERIES?
   * After creating a board, the dashboard's board list is stale.
   * Invalidating the cache forces a refetch, so the new board appears immediately.
   */
  const createMutation = useMutation({
    mutationFn: (name: string) => createBoard(name),
    onSuccess: (result) => {
      if (result.success) {
        // Invalidate all board queries (dashboard list will refetch)
        queryClient.invalidateQueries({ queryKey: boardKeys.all() })
        
        // Close the modal and reset the form
        setOpen(false)
        setName('')
        
        // Navigate to the newly created board
        router.push(`/boards/${result.data.id}`)
      } else {
        toast.error(result.error.message)
      }
    },
    onError: () => {
      toast.error('Failed to create board')
    },
  })

  /**
   * Form submission handler
   *
   * WHAT IT DOES:
   * - Prevents default form submission (page reload)
   * - Validates the board name (non-empty after trimming whitespace)
   * - Triggers the mutation with the trimmed name
   *
   * WHY TRIM WHITESPACE?
   * Users might accidentally add leading/trailing spaces.
   * We trim before sending to the server to avoid empty or whitespace-only names.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault() // Prevent page reload
    
    if (name.trim()) {
      createMutation.mutate(name.trim())
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Board</Button>} />
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Enter a name for your new board.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              placeholder="Board name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
