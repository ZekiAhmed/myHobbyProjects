// Lets the owner invite a new member by email. Surfaces the "warning"
// return value from createInvitation (see actions/invitations.ts) when
// the invite was saved but the email itself failed to send.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvitation } from "@/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteForm({ listId }: { listId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const result = await createInvitation(listId, email);

      if (result.warning) {
        setMessage({
          type: "warning",
          text: `${result.warning} (${result.inviteUrl})`,
        });
      } else {
        setMessage({ type: "success", text: `Invitation sent to ${email}.` });
      }

      setEmail("");
      router.refresh();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send invitation",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleInvite}>
      {message && <p role="alert">{message.text}</p>}
      <div className="grid gap-2">
        <Label htmlFor="invite-email">Invite by email</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}
