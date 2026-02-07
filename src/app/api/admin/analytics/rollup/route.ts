import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, analyticsSearchRollups } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const parseDate = (value: string | null, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const parseNumber = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readPayload = async (req: Request) => {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return (await req.json()) as Record<string, string> | null;
    } catch {
      return null;
    }
  }
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      const form = await req.formData();
      const data: Record<string, string> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") data[key] = value;
      }
      return data;
    } catch {
      return null;
    }
  }
  return null;
};

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

  const url = new URL(req.url);
  const body = await readPayload(req);
  const rangeDays = parseNumber(
    body?.rangeDays ?? url.searchParams.get("rangeDays"),
    30
  );
  const retentionDays = parseNumber(
    body?.retentionDays ?? url.searchParams.get("retentionDays"),
    90
  );
  const to = parseDate(body?.to ?? url.searchParams.get("to"), new Date());
  const from = parseDate(
    body?.from ?? url.searchParams.get("from"),
    new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
  );

  const rows = await db.execute(sql`
    SELECT
      date_trunc('day', created_at)::date AS day,
      lower(label) AS term,
      COUNT(*)::int AS searches,
      COUNT(DISTINCT session_id)::int AS unique_sessions,
      MAX(created_at) AS last_seen_at
    FROM ${analyticsEvents}
    WHERE event_type = 'SEARCH'
      AND label IS NOT NULL
      AND created_at >= ${from}
      AND created_at <= ${to}
    GROUP BY day, term;
  `);

  const rollups = (rows.rows ?? []).map((row) => ({
    day: row.day as string,
    term: String(row.term ?? ""),
    searches: Number(row.searches ?? 0),
    uniqueSessions: Number(row.unique_sessions ?? 0),
    lastSeenAt: row.last_seen_at ? new Date(String(row.last_seen_at)) : null,
  }));

  if (rollups.length > 0) {
    await db
      .insert(analyticsSearchRollups)
      .values(
        rollups.map((row) => ({
          day: row.day,
          term: row.term,
          searches: row.searches,
          uniqueSessions: row.uniqueSessions,
          lastSeenAt: row.lastSeenAt,
        }))
      )
      .onConflictDoUpdate({
        target: [
          analyticsSearchRollups.day,
          analyticsSearchRollups.term,
        ],
        set: {
          searches: sql`excluded.searches`,
          uniqueSessions: sql`excluded.unique_sessions`,
          lastSeenAt: sql`excluded.last_seen_at`,
        },
      });
  }

  const retentionCutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000
  );
  await db
    .delete(analyticsEvents)
    .where(
      sql`${analyticsEvents.eventType} = 'SEARCH' AND ${analyticsEvents.createdAt} < ${retentionCutoff}`
    );

  return NextResponse.json({
    ok: true,
    summary: {
      from,
      to,
      rolledUp: rollups.length,
      retentionDays,
    },
  });
}
