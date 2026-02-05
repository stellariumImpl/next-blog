import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";
import { getFeed } from "@/lib/feed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? "9");
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 9;
  const tagParam = searchParams.get("tags") ?? "";
  const tagSlugs = tagParam.split(",").map((tag) => tag.trim()).filter(Boolean);
  const match = searchParams.get("match") === "all" ? "all" : "any";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cursorDate = searchParams.get("cursorDate");
  const cursorId = searchParams.get("cursorId");
  const cursor =
    cursorDate && cursorId ? { date: cursorDate, id: cursorId } : null;

  const session = await auth.api.getSession({ headers: req.headers });
  const viewerId = session?.user?.id ?? null;
  const profile = session?.user
    ? await ensureUserProfile({ id: session.user.id, email: session.user.email })
    : null;

  const data = await getFeed({
    viewerId,
    isAdmin: profile?.role === "admin",
    tagSlugs,
    match,
    cursor,
    limit,
    from,
    to,
  });

  const response = NextResponse.json(data);
  if (process.env.NODE_ENV === "development") {
    try {
      const url = new URL(process.env.DATABASE_URL ?? "");
      response.headers.set("x-db-host", url.host);
      response.headers.set("x-db-name", url.pathname.replace("/", "") || "unknown");
    } catch {
      response.headers.set("x-db-host", "unknown");
    }
    response.headers.set("x-post-count", String(data.posts.length));
  }
  return response;
}
