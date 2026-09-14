import { NextResponse } from "next/server";
import { dbGetLists } from "@/lib/db/lists";
import { getApiSession } from "@/lib/session";

export async function GET() {
  const session = await getApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const lists = await dbGetLists();
    return NextResponse.json(lists);
  } catch (error) {
    console.error("[GET /api/lists]", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 },
    );
  }
}
