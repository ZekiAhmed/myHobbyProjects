import type { Metadata } from 'next'
import { AuthPanel } from '@/components/AuthPanel'

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Sign in or create an account',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthPanel>{children}</AuthPanel>
}
