'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleSignOut = async () => {
    setPending(true)
    try {
      await signOut()
      router.push('/sign-in')
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[4px] border border-black bg-white px-4 text-sm font-medium tracking-[0.01em] whitespace-nowrap text-black transition-[transform,background-color,color] duration-100 hover:bg-black hover:text-white active:translate-y-px focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
