import { NextResponse } from "next/server";
import { and, gt, lte } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, analyticsPageviews, analyticsSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/\r?\n/g, " ");
    if (str.includes(",") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  }
  return lines.join("\n");
};

const parseDate = (value: string | null, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

export async function GET(req: Request) {
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
  const type = url.searchParams.get("type") ?? "sessions";
  const rangeDays = Number(url.searchParams.get("rangeDays") ?? "30");
  const to = parseDate(url.searchParams.get("to"), new Date());
  const from = parseDate(
    url.searchParams.get("from"),
    new Date(Date.now() - Math.max(rangeDays, 1) * 24 * 60 * 60 * 1000)
  );

  let rows: Record<string, unknown>[] = [];
  if (type === "sessions") {
    rows = await db
      .select({
        id: analyticsSessions.id,
        ipHash: analyticsSessions.ipHash,
        country: analyticsSessions.country,
        region: analyticsSessions.region,
        city: analyticsSessions.city,
        os: analyticsSessions.os,
        browser: analyticsSessions.browser,
        startedAt: analyticsSessions.startedAt,
        lastSeenAt: analyticsSessions.lastSeenAt,
      })
      .from(analyticsSessions)
      .where(
        and(gt(analyticsSessions.startedAt, from), lte(analyticsSessions.startedAt, to))
      )
      .orderBy(analyticsSessions.startedAt);
  } else if (type === "pageviews") {
    rows = await db
      .select({
        id: analyticsPageviews.id,
        pageId: analyticsPageviews.pageId,
        sessionId: analyticsPageviews.sessionId,
        path: analyticsPageviews.path,
        referrer: analyticsPageviews.referrer,
        durationMs: analyticsPageviews.durationMs,
        startedAt: analyticsPageviews.startedAt,
        endedAt: analyticsPageviews.endedAt,
      })
      .from(analyticsPageviews)
      .where(
        and(
          gt(analyticsPageviews.startedAt, from),
          lte(analyticsPageviews.startedAt, to)
        )
      )
      .orderBy(analyticsPageviews.startedAt);
  } else if (type === "events") {
    rows = await db
      .select({
        id: analyticsEvents.id,
        sessionId: analyticsEvents.sessionId,
        pageId: analyticsEvents.pageId,
        path: analyticsEvents.path,
        eventType: analyticsEvents.eventType,
        label: analyticsEvents.label,
        target: analyticsEvents.target,
        href: analyticsEvents.href,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .where(and(gt(analyticsEvents.createdAt, from), lte(analyticsEvents.createdAt, to)))
      .orderBy(analyticsEvents.createdAt);
  } else {
    return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  const csv = toCsv(rows);
  const filename = `analytics-${type}-${from.toISOString().slice(0, 10)}-to-${to
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
