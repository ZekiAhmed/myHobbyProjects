// Implements the PRD's "Sign Up" flow exactly: collect email + password,
// create an (unverified) account via Better Auth, then redirect to
// /verify-email with a "check your inbox" message.
//
// Also supports being reached via an invite link: if the URL has
// ?inviteToken=xyz (see PRD invite flow, Branch A), we carry that token
// forward to /verify-email -> eventually app/invite/[token]/page.tsx picks
// it back up once the user is signed in.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {Input} from "@/components/ui/input"
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // The Better Auth client returns { data, error } rather than throwing,
    // so we check `result.error` explicitly instead of using try/catch.
    const result = await signUp.email({ name, email, password });

    setIsSubmitting(false);

    if (result.error) {
      setError(
        result.error.message ?? "Something went wrong. Please try again.",
      );
      return;
    }

    // Preserve the invite token through the verify-email step so we can
    // resume the invite-accept flow once the account is verified.
    const verifyUrl = inviteToken
      ? `/verify-email?inviteToken=${inviteToken}`
      : "/verify-email";

    router.push(verifyUrl);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Create your account</h1>

      {error && <p role="alert">{error}</p>}

      <div className="grid gap-2">
  <Label htmlFor="name">Name</Label>
  <Input
    id="name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
  />
</div>

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
    minLength={12}
    required
  />
</div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Sign up"}
      </Button>
    </form>
  );
}
