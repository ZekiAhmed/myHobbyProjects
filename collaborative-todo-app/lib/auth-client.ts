// The browser-side counterpart to lib/auth.ts. Client Components import
// hooks/functions FROM HERE (never from lib/auth.ts, which uses Node-only
// APIs and would break if bundled for the browser).
//
// Usage in a Client Component:
//   const { data: session } = useSession()
//   await signIn.email({ email, password })

import { createAuthClient } from 'better-auth/react'

export const { useSession, signIn, signUp, signOut } = createAuthClient({
  // Must be an absolute URL because this client can run in contexts (e.g.
  // during SSR) where a relative URL wouldn't resolve correctly.
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})