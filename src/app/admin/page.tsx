import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  analyticsPageviews,
  analyticsSessions,
  comments,
  commentRevisions,
  postRevisions,
  posts,
  tagRequests,
  tagRevisions,
} from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import { Inbox, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminHome() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [pendingPosts] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(posts)
    .where(eq(posts.status, 'pending'))
    .limit(1);
  const [pendingPostEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(postRevisions)
    .where(eq(postRevisions.status, 'pending'))
    .limit(1);
  const [pendingComments] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(comments)
    .where(eq(comments.status, 'pending'))
    .limit(1);
  const [pendingCommentEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commentRevisions)
    .where(eq(commentRevisions.status, 'pending'))
    .limit(1);
  const [pendingTags] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tagRequests)
    .where(eq(tagRequests.status, 'pending'))
    .limit(1);
  const [pendingTagEdits] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(tagRevisions)
    .where(eq(tagRevisions.status, 'pending'))
    .limit(1);

  const totalPending =
    (pendingPosts?.count ?? 0) +
    (pendingPostEdits?.count ?? 0) +
    (pendingComments?.count ?? 0) +
    (pendingCommentEdits?.count ?? 0) +
    (pendingTags?.count ?? 0) +
    (pendingTagEdits?.count ?? 0);

  let analyticsError: string | null = null;
  let stats = {
    sessions: 0,
    pageviews: 0,
    uniqueVisitors: 0,
    avgDurationMs: 0,
    bounceRate: 0,
    topPages: [] as { path: string; views: number }[],
  };

  try {
    const [pageviews] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(analyticsPageviews)
      .where(gt(analyticsPageviews.startedAt, since))
      .limit(1);

    const [sessions] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(analyticsSessions)
      .where(gt(analyticsSessions.startedAt, since))
      .limit(1);

    const [uniqueVisitors] = await db
      .select({
        count: sql<number>`count(distinct ${analyticsSessions.ipHash})`.mapWith(
          Number
        ),
      })
      .from(analyticsSessions)
      .where(gt(analyticsSessions.startedAt, since))
      .limit(1);

    const [avgDuration] = await db
      .select({
        avg: sql<number>`avg(${analyticsPageviews.durationMs})`.mapWith(Number),
      })
      .from(analyticsPageviews)
      .where(
        and(
          gt(analyticsPageviews.startedAt, since),
          isNotNull(analyticsPageviews.durationMs)
        )
      )
      .limit(1);

    const bounceThresholdMs = 15000;
    const bounceStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE pv_count = 1 AND avg_duration < ${bounceThresholdMs}
        )::int AS bounce,
        COUNT(*)::int AS total
      FROM (
        SELECT session_id,
               COUNT(*) AS pv_count,
               COALESCE(AVG(duration_ms), 0) AS avg_duration
        FROM ${analyticsPageviews}
        WHERE started_at >= ${since}
        GROUP BY session_id
      ) t;
    `);

    const bounceRow = bounceStats.rows?.[0] as
      | { bounce?: number; total?: number }
      | undefined;
    const bounce = bounceRow?.bounce ?? 0;
    const totalSessions = bounceRow?.total ?? 0;
    const bounceRate = totalSessions > 0 ? bounce / totalSessions : 0;

    const topPages = await db
      .select({
        path: analyticsPageviews.path,
        views: sql<number>`count(*)`.mapWith(Number),
      })
      .from(analyticsPageviews)
      .where(gt(analyticsPageviews.startedAt, since))
      .groupBy(analyticsPageviews.path)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    stats = {
      sessions: sessions?.count ?? 0,
      pageviews: pageviews?.count ?? 0,
      uniqueVisitors: uniqueVisitors?.count ?? 0,
      avgDurationMs: avgDuration?.avg ?? 0,
      bounceRate,
      topPages,
    };
  } catch (error) {
    analyticsError =
      error instanceof Error ? error.message : 'Analytics unavailable.';
  }

  const formatDuration = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return '--';
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${rem}s`;
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Shield className="h-4 w-4" />
          Admin Console
        </div>
        <h1 className="mt-4 text-3xl font-semibold">Editorial Overview</h1>
        <p className="mt-2 text-zinc-400">
          Monitor submissions, reviews, and user requests across the platform.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Shield className="h-4 w-4" />
          Statistic Overview (Last 30 Days)
        </div>
        {analyticsError ? (
          <div className="border border-red-500/40 bg-zinc-950/60 p-4 text-sm text-red-400">
            Analytics unavailable: {analyticsError}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
              <div className="text-xs uppercase text-zinc-500">Sessions</div>
              <div className="mt-2 text-2xl font-semibold">{stats.sessions}</div>
            </div>
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
              <div className="text-xs uppercase text-zinc-500">Pageviews</div>
              <div className="mt-2 text-2xl font-semibold">{stats.pageviews}</div>
            </div>
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
              <div className="text-xs uppercase text-zinc-500">Unique Visitors</div>
              <div className="mt-2 text-2xl font-semibold">{stats.uniqueVisitors}</div>
            </div>
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
              <div className="text-xs uppercase text-zinc-500">Avg Duration</div>
              <div className="mt-2 text-2xl font-semibold">
                {formatDuration(stats.avgDurationMs)}
              </div>
            </div>
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
              <div className="text-xs uppercase text-zinc-500">Bounce Rate</div>
              <div className="mt-2 text-2xl font-semibold">
                {Math.round(stats.bounceRate * 100)}%
              </div>
            </div>
          </div>
        )}

        {!analyticsError && (
          <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
            <div className="text-xs uppercase text-zinc-500">Top Pages</div>
            {stats.topPages.length === 0 ? (
              <div className="mt-3 text-sm text-zinc-500">
                No traffic recorded yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                {stats.topPages.map((page) => (
                  <div
                    key={page.path}
                    className="flex items-center justify-between border-b border-zinc-800/60 pb-2"
                  >
                    <span className="truncate pr-4">{page.path}</span>
                    <span className="text-zinc-400">{page.views}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {totalPending === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="No pending reviews"
          description="Everything is reviewed and up to date."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Link
            href="/admin/posts"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Posts</div>
            <div className="mt-2 text-lg">Review pending posts and edits</div>
          </Link>
          <Link
            href="/admin/comments"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Comments</div>
            <div className="mt-2 text-lg">Approve or reject comment activity</div>
          </Link>
          <Link
            href="/admin/tags"
            className="border border-zinc-800 rounded p-4 bg-zinc-900/40 hover:border-[#00ff41] transition"
          >
            <div className="text-xs uppercase text-zinc-500">Tags</div>
            <div className="mt-2 text-lg">Manage taxonomy requests</div>
          </Link>
        </div>
      )}
    </div>
  );
}
