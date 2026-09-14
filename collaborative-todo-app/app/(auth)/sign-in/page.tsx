// Handles normal sign-in PLUS two special redirect cases:
//   1. ?callbackUrl=... — set by proxy.ts when an unauthenticated user
//      tried to visit a protected page. After a successful sign-in, we
//      send them back to where they were originally headed.
//   2. ?inviteToken=... — set when an EXISTING but currently signed-out
//      user clicks an invite link (PRD invite flow, Branch B). After
//      sign-in, we redirect to /invite/[token] to complete acceptance.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const inviteToken = searchParams.get("inviteToken");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setIsSubmitting(true);

    const result = await signIn.email({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      // Better Auth surfaces a specific error code when the account exists
      // but hasn't verified its email yet — we show a dedicated
      // "resend verification" prompt for that case (per PRD sign-in flow).
      if (result.error.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      } else {
        setError(result.error.message ?? "Invalid email or password.");
      }
      return;
    }

    // Priority: an invite token takes the user to finish accepting that
    // invite; otherwise fall back to wherever proxy.ts redirected them
    // from; otherwise just go to the dashboard.
    if (inviteToken) {
      router.push(`/invite/${inviteToken}`);
    } else {
      router.push(callbackUrl ?? "/");
    }
  }

  async function handleResendVerification() {
    await signIn.email({ email, password }); // Better Auth resends on retry
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign in</h1>

      {error && <p role="alert">{error}</p>}

      {needsVerification && (
        <div role="alert">
          <p>Please verify your email before signing in.</p>
          <Button type="button" onClick={handleResendVerification}>
            Resend verification email
          </Button>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <a href="/forgot-password">Forgot password?</a>
      <a href="/sign-up">Sign Up</a>
    </form>
  );
}
