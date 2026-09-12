// A simple "check your inbox" holding page shown right after sign-up.
// The actual verification happens when the user clicks the link in their
// email (handled entirely by Better Auth's built-in verification route —
// there's no custom code needed for that part). This page's only real job
// is to preserve the inviteToken (if any) so it survives all the way to
// the moment the user is finally authenticated and can accept the invite.

'use client'

import { useSearchParams } from 'next/navigation'

export default function VerifyEmailPage() {
  const inviteToken = useSearchParams().get('inviteToken')

  return (
    <div>
      <h1>Check your inbox</h1>
      <p>We've sent you a verification link. Click it to activate your account.</p>

      {/* Once the user verifies and signs in, sign-in/page.tsx reads this
          same inviteToken from the URL and forwards to /invite/[token]. */}
      {inviteToken && (
        <p>
          After verifying, <a href={`/sign-in?inviteToken=${inviteToken}`}>sign in here</a> to
          finish accepting your invite.
        </p>
      )}
    </div>
  )
}