// Step 2 of the password-reset flow. The `token` query param was embedded
// in the reset-link email by Better Auth — we don't validate it ourselves,
// we just pass it straight through to authClient.resetPassword(), which
// asks the server to validate it.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "This reset link is missing its token — please request a new one.",
      );
      return;
    }

    setIsSubmitting(true);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "This link is invalid or has expired.");
      return;
    }

    router.push("/sign-in");
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Choose a new password</h1>
      {error && <p role="alert">{error}</p>}
      <div className="grid gap-2">
        <Label htmlFor="email">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Reset password"}
      </Button>
    </form>
  );
}
