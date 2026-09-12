// Shared shell for every LOGGED-IN page (dashboard, board, settings): the
// TanStack Query provider and a global nav bar. This layout does NOT do
// its own auth check — every page underneath it calls getRequiredSession()
// individually, which is more robust than relying on a single shared
// layout-level check (see lib/session.ts comments on why we never assume
// auth from one layer alone).

// import { QueryProvider } from '@/providers/QueryProvider'
// import { signOut } from '@/lib/auth-client'

// export default function AppLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <QueryProvider>
//       <nav>
//         <a href="/">Dashboard</a>
//         {/* signOut() clears both the DB session row and the browser cookie
//             — see lib/auth.ts session config. */}
//         <button onClick={() => signOut({ fetchOptions: { onSuccess: () => (window.location.href = '/sign-in') } })}>
//           Sign out
//         </button>
//       </nav>
//       <main>{children}</main>
//     </QueryProvider>
//   )
// }

//==============================
// the above code:

// This error occurs because the arrow function () => (window.location.href = '/sign-in') implicitly returns the result of the assignment expression (a string), but onSuccess expects a function that returns void or Promise<void>.

// To fix this, wrap the assignment statement in curly braces {} so the callback function returns nothing (void).
//===============================================

//==================================================================================

import { QueryProvider } from "@/providers/QueryProvider";
import { signOut } from "@/lib/auth-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <nav>
        <a href="/">Dashboard</a>
        {/* signOut() clears both the DB session row and the browser cookie
            — see lib/auth.ts session config. */}
        <button
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/sign-in";
                },
              },
            })
          }
        >
          Sign out
        </button>
      </nav>
      <main>{children}</main>
    </QueryProvider>
  );
}
