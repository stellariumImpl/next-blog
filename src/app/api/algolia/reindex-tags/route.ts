import { NextResponse } from "next/server";
import { reindexAlgoliaTags } from "@/lib/algolia";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await ensureUserProfile({
    id: session.user.id,
    email: session.user.email,
  });
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await reindexAlgoliaTags(db);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reindex failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
