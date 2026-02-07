import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  analyticsFeatureVectors,
  analyticsPageviews,
  comments,
  postLikes,
  posts,
  postTags,
  tags,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const parseRangeDays = async (req: Request) => {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("rangeDays");
  if (fromQuery) {
    const parsed = Number(fromQuery);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await req.json()) as { rangeDays?: number } | null;
      const parsed = Number(body?.rangeDays);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
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
      const raw = form.get("rangeDays");
      if (typeof raw === "string") {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
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

  const rangeDays = await parseRangeDays(req);
  const now = new Date();
  const since = rangeDays
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000)
    : null;

  const windowFilter = since
    ? sql`AND pv.started_at >= ${since}`
    : sql``;

  try {
    const postMetrics = await db.execute(sql`
      WITH post_metrics AS (
        SELECT
          p.id AS post_id,
          COUNT(pv.id)::int AS views,
          COUNT(DISTINCT pv.session_id)::int AS unique_sessions,
          COALESCE(SUM(pv.duration_ms), 0)::int AS total_duration,
          COALESCE(AVG(pv.duration_ms), 0)::int AS avg_duration,
          MAX(pv.started_at) AS last_seen
        FROM ${posts} p
        LEFT JOIN ${analyticsPageviews} pv
          ON p.slug = split_part(split_part(pv.path, '?', 1), '/posts/', 2)
         AND pv.path LIKE '/posts/%'
         ${windowFilter}
        WHERE p.status = 'published'
        GROUP BY p.id
      ),
      likes_by_post AS (
        SELECT post_id, COUNT(*)::int AS like_count
        FROM ${postLikes}
        GROUP BY post_id
      ),
      comments_by_post AS (
        SELECT post_id, COUNT(*)::int AS comment_count
        FROM ${comments}
        WHERE status = 'approved'
        GROUP BY post_id
      )
      SELECT
        pm.post_id,
        pm.views,
        pm.unique_sessions,
        pm.total_duration,
        pm.avg_duration,
        pm.last_seen,
        COALESCE(lb.like_count, 0)::int AS likes,
        COALESCE(cb.comment_count, 0)::int AS comments
      FROM post_metrics pm
      LEFT JOIN likes_by_post lb ON lb.post_id = pm.post_id
      LEFT JOIN comments_by_post cb ON cb.post_id = pm.post_id;
    `);

    const postVectors = (postMetrics.rows ?? []).map((row) => {
      const postId = String(row.post_id);
      return {
        entityType: "post" as const,
        entityId: postId,
        features: {
          views: Number(row.views ?? 0),
          uniqueSessions: Number(row.unique_sessions ?? 0),
          totalDurationMs: Number(row.total_duration ?? 0),
          avgDurationMs: Number(row.avg_duration ?? 0),
          likes: Number(row.likes ?? 0),
          comments: Number(row.comments ?? 0),
          lastSeenAt: row.last_seen
            ? new Date(String(row.last_seen)).toISOString()
            : null,
        },
        sourceFrom: since,
        sourceTo: now,
        updatedAt: now,
      };
    });

    const tagMetrics = await db.execute(sql`
      WITH post_metrics AS (
        SELECT
          p.id AS post_id,
          COUNT(pv.id)::int AS views,
          COUNT(DISTINCT pv.session_id)::int AS unique_sessions,
          COALESCE(SUM(pv.duration_ms), 0)::int AS total_duration
        FROM ${posts} p
        LEFT JOIN ${analyticsPageviews} pv
          ON p.slug = split_part(split_part(pv.path, '?', 1), '/posts/', 2)
         AND pv.path LIKE '/posts/%'
         ${windowFilter}
        WHERE p.status = 'published'
        GROUP BY p.id
      ),
      likes_by_post AS (
        SELECT post_id, COUNT(*)::int AS like_count
        FROM ${postLikes}
        GROUP BY post_id
      ),
      comments_by_post AS (
        SELECT post_id, COUNT(*)::int AS comment_count
        FROM ${comments}
        WHERE status = 'approved'
        GROUP BY post_id
      )
      SELECT
        t.id AS tag_id,
        COUNT(DISTINCT pt.post_id)::int AS post_count,
        COALESCE(SUM(pm.views), 0)::int AS views,
        COALESCE(SUM(pm.unique_sessions), 0)::int AS unique_sessions,
        COALESCE(SUM(pm.total_duration), 0)::int AS total_duration,
        COALESCE(SUM(lb.like_count), 0)::int AS likes,
        COALESCE(SUM(cb.comment_count), 0)::int AS comments
      FROM ${tags} t
      LEFT JOIN ${postTags} pt ON pt.tag_id = t.id
      LEFT JOIN ${posts} p ON p.id = pt.post_id AND p.status = 'published'
      LEFT JOIN post_metrics pm ON pm.post_id = p.id
      LEFT JOIN likes_by_post lb ON lb.post_id = p.id
      LEFT JOIN comments_by_post cb ON cb.post_id = p.id
      GROUP BY t.id;
    `);

    const tagVectors = (tagMetrics.rows ?? []).map((row) => {
      const tagId = String(row.tag_id);
      const views = Number(row.views ?? 0);
      const totalDuration = Number(row.total_duration ?? 0);
      return {
        entityType: "tag" as const,
        entityId: tagId,
        features: {
          postCount: Number(row.post_count ?? 0),
          views,
          uniqueSessions: Number(row.unique_sessions ?? 0),
          totalDurationMs: totalDuration,
          avgDurationMs: views > 0 ? Math.round(totalDuration / views) : 0,
          likes: Number(row.likes ?? 0),
          comments: Number(row.comments ?? 0),
        },
        sourceFrom: since,
        sourceTo: now,
        updatedAt: now,
      };
    });

    if (postVectors.length > 0) {
      await db
        .insert(analyticsFeatureVectors)
        .values(postVectors)
        .onConflictDoUpdate({
          target: [
            analyticsFeatureVectors.entityType,
            analyticsFeatureVectors.entityId,
          ],
          set: {
            features: sql`excluded.features`,
            sourceFrom: since,
            sourceTo: now,
            updatedAt: now,
          },
        });
    }

    if (tagVectors.length > 0) {
      await db
        .insert(analyticsFeatureVectors)
        .values(tagVectors)
        .onConflictDoUpdate({
          target: [
            analyticsFeatureVectors.entityType,
            analyticsFeatureVectors.entityId,
          ],
          set: {
            features: sql`excluded.features`,
            sourceFrom: since,
            sourceTo: now,
            updatedAt: now,
          },
        });
    }

    return NextResponse.json({
      ok: true,
      summary: {
        rangeDays: rangeDays ?? null,
        sourceFrom: since,
        sourceTo: now,
        posts: postVectors.length,
        tags: tagVectors.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rebuild failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
