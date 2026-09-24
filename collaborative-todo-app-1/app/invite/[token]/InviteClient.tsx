'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface InviteClientProps {
  token: string
  error?: string
}

export default function InviteClient({ error }: InviteClientProps) {
  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Error</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Button
          render={<Link href="/boards" />}
          nativeButton={false}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          Go to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="text-center">
      <p className="text-gray-600">Processing invitation...</p>
    </div>
  )
}
