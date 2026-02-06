import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { tags } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ name: tags.name, slug: tags.slug })
    .from(tags)
    .orderBy(asc(tags.name));

  const response = NextResponse.json({ tags: rows });
  if (process.env.NODE_ENV === "development") {
    try {
      const url = new URL(process.env.DATABASE_URL ?? "");
      response.headers.set("x-db-host", url.host);
      response.headers.set("x-db-name", url.pathname.replace("/", "") || "unknown");
    } catch {
      response.headers.set("x-db-host", "unknown");
    }
    response.headers.set("x-tag-count", String(rows.length));
  }
  return response;
}
