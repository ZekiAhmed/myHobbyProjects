"use client";

import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
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
    </Button>
  );
}
