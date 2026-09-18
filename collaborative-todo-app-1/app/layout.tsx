// app/layout.tsx
//
// The ROOT layout — required by Next.js App Router. Every other layout in
// this app, (auth)/layout implicit and (app)/layout.tsx, nests INSIDE this
// one automatically. Route groups (folders in parens) never add a URL
// segment, but they also never provide their own <html>/<body> — that can
// only be defined once, here.
//
// Kept deliberately minimal: no nav, no auth check, no QueryProvider here.
// Those live in app/(app)/layout.tsx instead, because they only make sense
// for the logged-in shell — a visitor on /sign-in or an /invite/[token]
// link shouldn't render a "Sign out" button or a board nav bar.

import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kanban',
  description: 'A collaborative Kanban todo app for small teams.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}