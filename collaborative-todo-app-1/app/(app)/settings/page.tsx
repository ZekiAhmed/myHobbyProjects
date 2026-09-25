import { getRequiredSession } from '@/lib/session'
import { AccountSettingsClient } from '@/components/settings/AccountSettingsClient'

export default async function AccountSettingsPage() {
  const session = await getRequiredSession()

  return <AccountSettingsClient name={session.user.name} email={session.user.email} />
}
