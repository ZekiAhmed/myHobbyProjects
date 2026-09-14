// Powers the dashboard: "every list I own OR am a member of," with a
// count of members and OPEN (not-yet-done) todos per list, so the
// dashboard cards can show that info without a second round-trip per card.

import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function dbGetLists() {
  const session = await getRequiredSession();

  const lists = await prisma.list.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        { members: { some: { userId: session.user.id } } },
      ],
    },
    // `_count` lets Prisma compute these counts in the SAME query instead
    // of us looping over lists and querying each one's members/todos
    // separately (that N+1 pattern is explicitly called out as a risk to
    // avoid in TDD §9).
    include: {
      _count: {
        select: {
          members: true,
          todos: { where: { status: { not: "DONE" } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Reshape into exactly what the dashboard UI needs, and flag whether the
  // CURRENT user is the owner of each list (drives "Lists I Own" vs.
  // "Lists I'm a Member of" grouping in the UI).
  const shaped = lists.map((list) => ({
    id: list.id,
    name: list.name,
    isOwner: list.ownerId === session.user.id,
    memberCount: list._count.members,
    openTodoCount: list._count.todos,
  }));

  return NextResponse.json(shaped);
}
