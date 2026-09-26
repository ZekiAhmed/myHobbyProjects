'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageShell } from '@/components/PageShell'
import { SignOutButton } from '@/components/SignOutButton'
import { ActiveSessions } from '@/components/settings/ActiveSessions'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AccountSettingsClientProps {
  name: string
  email: string
}

export function AccountSettingsClient({ name, email }: AccountSettingsClientProps) {
  return (
    <PageShell
      title="Account settings"
      narrow
      leading={
        <Link
          href="/boards"
          className="-ml-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to boards"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      }
    >
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <section className="bg-white rounded-xl ring-1 ring-foreground/10 p-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Your account</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="text-sm font-medium text-gray-900">{name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm font-medium text-gray-900">{email}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4">
              <SignOutButton />
            </div>
          </section>

          <section className="mt-4 bg-white rounded-xl ring-1 ring-foreground/10 p-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">Your data</h3>
            <p className="text-sm text-gray-500 mb-3">
              Download a JSON copy of your personal data: profile, Active sessions, boards,
              todos, comments, notifications, activity, and invitations. Password hashes,
              session tokens, and invite tokens are never included.
            </p>
            <Button variant="outline" render={<a href="/api/me/export" />} nativeButton={false}>
              Export my data
            </Button>
          </section>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <ActiveSessions />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
