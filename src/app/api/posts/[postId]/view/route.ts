import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: { postId: string } }
) {
  const postId = params.postId;
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  await db
    .update(posts)
    .set({ views: sql`${posts.views} + 1` })
    .where(eq(posts.id, postId));

  return NextResponse.json({ ok: true });
}
