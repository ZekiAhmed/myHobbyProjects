// The "New List" creation modal. Calls the createList Server Action
// directly (Server Actions can be called straight from client components
// like a regular async function — no separate API route needed), then
// invalidates the dashboard's TanStack Query cache so the new list shows
// up immediately without a manual page refresh.

// 'use client'

// import { useState } from 'react'
// import { useRouter } from 'next/navigation'
// import { useQueryClient } from '@tanstack/react-query'
// import { createList } from '@/actions/lists'
// import { listKeys } from '@/lib/queries/lists'
// import { Button } from '@/components/ui/button'
// import { Modal } from '@/components/ui/'
// import { Input} from '@/components/ui/input'

// export function NewListModal({ onClose }: { onClose: () => void }) {
//   const router = useRouter()
//   const queryClient = useQueryClient()
//   const [name, setName] = useState('')
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [error, setError] = useState<string | null>(null)

//   async function handleCreate() {
//     setIsSubmitting(true)
//     setError(null)

//     try {
//       const result = await createList(name)

//       // The Server Action already called revalidateTag('lists') for the
//       // NEXT server render, but the browser's TanStack Query cache is a
//       // separate, in-memory thing — we invalidate it here too so this
//       // client immediately refetches and shows the new list.
//       await queryClient.invalidateQueries({ queryKey: listKeys.all() })

//       // Jump straight into the freshly created board, per PRD dashboard flow.
//       router.push(`/lists/${result.list.id}`)
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Failed to create list')
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <Modal onClose={onClose} title="Create a new list">
//       {error && <p role="alert">{error}</p>}
//       <Input
//         label="List name"
//         value={name}
//         onChange={(e) => setName(e.target.value)}
//         autoFocus
//       />
//       <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
//         {isSubmitting ? 'Creating…' : 'Create'}
//       </Button>
//     </Modal>
//   )
// }


//===============================================================================


'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createList } from '@/actions/lists'
import { listKeys } from '@/lib/queries/lists'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export function NewListModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await createList(name)

      // Invalidate query cache for instant client update
      await queryClient.invalidateQueries({ queryKey: listKeys.all() })

      // Navigate to the newly created list
      router.push(`/lists/${result.list.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create list')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Create a new list</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="py-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="List name"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}