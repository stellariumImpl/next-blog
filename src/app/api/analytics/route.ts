import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, analyticsPageviews, analyticsSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PATH_LENGTH = 2048;
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;

const pageViewSchema = z.object({
  type: z.literal("page_view"),
  sessionId: z.string().min(6).max(128),
  pageId: z.string().min(6).max(128),
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  referrer: z.string().max(MAX_PATH_LENGTH).optional().nullable(),
});

const pageDurationSchema = z.object({
  type: z.literal("page_duration"),
  sessionId: z.string().min(6).max(128),
  pageId: z.string().min(6).max(128),
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  durationMs: z.number().int().nonnegative().max(MAX_DURATION_MS),
});

const clickSchema = z.object({
  type: z.literal("click"),
  sessionId: z.string().min(6).max(128),
  pageId: z.string().min(6).max(128),
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  label: z.string().max(140).optional().nullable(),
  target: z.string().max(80).optional().nullable(),
  href: z.string().max(MAX_PATH_LENGTH).optional().nullable(),
});

const customEventSchema = z.object({
  type: z.literal("event"),
  sessionId: z.string().min(6).max(128),
  pageId: z.string().min(6).max(128),
  path: z.string().min(1).max(MAX_PATH_LENGTH),
  eventType: z.string().min(1).max(64),
  label: z.string().max(140).optional().nullable(),
  target: z.string().max(80).optional().nullable(),
  href: z.string().max(MAX_PATH_LENGTH).optional().nullable(),
});

const eventSchema = z.discriminatedUnion("type", [
  pageViewSchema,
  pageDurationSchema,
  clickSchema,
  customEventSchema,
]);

const payloadSchema = z.object({
  events: z.array(eventSchema).min(1).max(10),
});

const parseBrowser = (ua: string) => {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
};

const parseOS = (ua: string) => {
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
};

const getClientIp = (headers: Headers) => {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const vercelIp = headers.get("x-vercel-ip-address");
  if (vercelIp) return vercelIp;
  return null;
};

const getGeo = (headers: Headers) => {
  const country =
    headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry") || null;
  const region =
    headers.get("x-vercel-ip-country-region") ||
    headers.get("x-vercel-ip-region") ||
    headers.get("cf-region") ||
    null;
  const city =
    headers.get("x-vercel-ip-city") || headers.get("cf-ipcity") || null;
  return { country, region, city };
};

const hashIp = (ip: string) => {
  const salt =
    process.env.ANALYTICS_SALT ||
    process.env.BETTER_AUTH_SECRET ||
    "local-dev-salt";
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
};

export async function POST(req: Request) {
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const session = await auth.api
    .getSession({ headers: req.headers })
    .catch(() => null);
  const userId = session?.user?.id ?? null;

  const ua = req.headers.get("user-agent") ?? "";
  const ip = getClientIp(req.headers) ?? "0.0.0.0";
  const ipHash = hashIp(ip);
  const { country, region, city } = getGeo(req.headers);
  const os = parseOS(ua);
  const browser = parseBrowser(ua);
  const now = new Date();

  for (const event of payload.events) {
    const sessionId = event.sessionId;
    const sessionUpdate: Partial<typeof analyticsSessions.$inferInsert> = {
      lastSeenAt: now,
    };
    if (userId) sessionUpdate.userId = userId;
    if (country) sessionUpdate.country = country;
    if (region) sessionUpdate.region = region;
    if (city) sessionUpdate.city = city;
    if (os) sessionUpdate.os = os;
    if (browser) sessionUpdate.browser = browser;

    await db
      .insert(analyticsSessions)
      .values({
        id: sessionId,
        userId,
        ipHash,
        country,
        region,
        city,
        os,
        browser,
        startedAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: analyticsSessions.id,
        set: sessionUpdate,
      });

    if (event.type === "page_view") {
      await db
        .insert(analyticsPageviews)
        .values({
          pageId: event.pageId,
          sessionId,
          path: event.path,
          referrer: event.referrer ?? null,
          startedAt: now,
        })
        .onConflictDoNothing({ target: analyticsPageviews.pageId });
      continue;
    }

    if (event.type === "page_duration") {
      const durationMs = Math.min(
        Math.max(event.durationMs ?? 0, 0),
        MAX_DURATION_MS
      );

      const updated = await db
        .update(analyticsPageviews)
        .set({ durationMs, endedAt: now })
        .where(
          and(
            eq(analyticsPageviews.pageId, event.pageId),
            eq(analyticsPageviews.sessionId, sessionId)
          )
        )
        .returning({ id: analyticsPageviews.id });

      if (updated.length === 0) {
        await db
          .insert(analyticsPageviews)
          .values({
            pageId: event.pageId,
            sessionId,
            path: event.path,
            referrer: null,
            startedAt: now,
            endedAt: now,
            durationMs,
          })
          .onConflictDoNothing({ target: analyticsPageviews.pageId });
      }
      continue;
    }

    if (event.type === "click") {
      await db.insert(analyticsEvents).values({
        sessionId,
        pageId: event.pageId,
        path: event.path,
        eventType: "click",
        label: event.label ?? null,
        target: event.target ?? null,
        href: event.href ?? null,
        createdAt: now,
      });
      continue;
    }

    if (event.type === "event") {
      await db.insert(analyticsEvents).values({
        sessionId,
        pageId: event.pageId,
        path: event.path,
        eventType: event.eventType,
        label: event.label ?? null,
        target: event.target ?? null,
        href: event.href ?? null,
        createdAt: now,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
