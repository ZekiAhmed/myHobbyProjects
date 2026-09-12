// The most security-sensitive Server Actions in the app — read
// lib/utils/invite-tokens.ts first if you haven't already.
//
// Two rate limits protect this flow (see TDD §9):
//   - Creating invites: 20/hour per inviting user (stops one compromised
//     account from spamming invite emails).
//   - Accepting invites: handled in app/invite/[token]/page.tsx, 30
//     requests/60s per IP (stops token brute-forcing).

"use server";

import { prisma } from "@/lib/db";
import { getRequiredSession, getOptionalSession } from "@/lib/session";
import { updateTag } from "next/cache";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/redis";
import {
  generateInviteToken,
  getInviteExpiry,
  isInviteValid,
} from "@/lib/utils/invite-tokens";

/** Owner invites someone by email. Creates an Invitation row + sends an email. */
export async function createInvitation(listId: string, email: string) {
  const session = await getRequiredSession();

  const list = await prisma.list.findUniqueOrThrow({ where: { id: listId } });

  if (list.ownerId !== session.user.id) {
    throw new Error("Forbidden: only the list owner can invite members");
  }

  // Rate limit: max 20 invitations per hour, per INVITING USER (not per
  // list) — this stops a single compromised account from mass-inviting
  // across many different lists to spam an inbox.
  const { allowed } = await checkRateLimit(
    `invite-create:${session.user.id}`,
    20,
    60 * 60,
  );
  if (!allowed) {
    throw new Error(
      "Too many invitations sent recently. Please try again later.",
    );
  }

  const invitation = await prisma.invitation.create({
    data: {
      listId,
      email: email.trim().toLowerCase(),
      token: generateInviteToken(),
      expiresAt: getInviteExpiry(),
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`;
  const emailResult = await sendEmail({
    to: invitation.email,
    subject: `You've been invited to join "${list.name}"`,
    template: "invite",
    props: { url: inviteUrl, listName: list.name },
  });

  updateTag("list-detail");

  // Graceful degradation per TDD §9: the invite record + link are valid
  // regardless of whether the email actually sent — so we tell the owner
  // if the email failed, but we don't treat it as a hard error.
  if (!emailResult.success) {
    return {
      success: true,
      warning:
        "Invite saved but the email failed to send — share this link manually.",
      inviteUrl,
    };
  }

  return { success: true };
}

/**
 * Accepts an invitation by token. Handles all three "who is accepting this"
 * branches from the PRD's invite flow:
 *   A) brand-new user (no account yet)         -> caller redirects to /sign-up
 *   B) existing user, not currently signed in   -> caller redirects to /sign-in
 *   C) already signed in                        -> we can accept right now
 *
 * This function itself only handles the "already have a valid session"
 * case (C) — branches A and B are routing decisions made in
 * app/invite/[token]/page.tsx BEFORE this function is ever called, because
 * there's no session to act on yet in those cases.
 */
export async function acceptInvitation(token: string) {
  const session = await getOptionalSession();

  if (!session) {
    // Shouldn't normally happen — the page should have redirected to
    // sign-in/sign-up first — but guard anyway rather than crash.
    throw new Error("You must be signed in to accept an invitation");
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation || !isInviteValid(invitation)) {
    throw new Error("This invite link is invalid or has expired.");
  }

  // Only add a membership row if one doesn't already exist — this makes
  // acceptInvitation safe to call more than once for the same user
  // (e.g. if they refresh the invite page after already accepting).
  await prisma.$transaction([
    prisma.listMember.upsert({
      where: {
        listId_userId: { listId: invitation.listId, userId: session.user.id },
      },
      create: { listId: invitation.listId, userId: session.user.id },
      update: {}, // already a member — nothing to change
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    }),
  ]);

  updateTag("lists");
  updateTag("list-detail");

  return { success: true, listId: invitation.listId };
}
