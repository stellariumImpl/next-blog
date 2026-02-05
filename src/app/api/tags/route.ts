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

  return NextResponse.json({ tags: rows });
}
