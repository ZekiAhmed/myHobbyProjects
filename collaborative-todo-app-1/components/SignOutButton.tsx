'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

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
    <Button variant="outline" onClick={handleSignOut} disabled={pending}>
      {pending ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}
