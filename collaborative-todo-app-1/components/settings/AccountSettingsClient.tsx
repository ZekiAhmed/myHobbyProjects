'use client'

import { BackLink } from '@/components/BackLink'
import { PageShell } from '@/components/PageShell'
import { SettingsSection } from '@/components/settings/SettingsSection'
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
      leading={<BackLink href="/boards" label="Back to boards" />}
    >
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <SettingsSection title="Your account">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="text-sm font-medium text-foreground">{name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground">{email}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <SignOutButton />
            </div>
          </SettingsSection>

          <SettingsSection title="Your data" titleClassName="mb-1" className="mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Download a JSON copy of your personal data: profile, Active sessions, boards,
              todos, comments, notifications, activity, and invitations. Password hashes,
              session tokens, and invite tokens are never included.
            </p>
            <Button variant="outline" render={<a href="/api/me/export" />} nativeButton={false}>
              Export my data
            </Button>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <ActiveSessions />
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
