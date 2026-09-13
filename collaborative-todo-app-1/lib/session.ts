import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function getRequiredSession() {
  const session = await getOptionalSession()
  if (!session) {
    redirect('/sign-in')
  }
  return session
}

export async function getOptionalSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}
