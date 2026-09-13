'use server'

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function signOut() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (session) {
    await auth.api.signOut({
      headers: await headers(),
    })
  }

  redirect('/sign-in')
}
