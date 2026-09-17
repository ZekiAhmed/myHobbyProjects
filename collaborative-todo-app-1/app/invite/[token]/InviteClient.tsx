'use client'

import Link from 'next/link'

interface InviteClientProps {
  token: string
  error?: string
}

export default function InviteClient({ token, error }: InviteClientProps) {
  if (error) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Error</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link
          href="/"
          className="inline-block bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="text-center">
      <p className="text-gray-600">Processing invitation...</p>
    </div>
  )
}
