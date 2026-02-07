import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  analyticsPageviews,
  analyticsEvents,
  analyticsFeatureVectors,
  analyticsSearchRollups,
  analyticsSessions,
  comments,
  commentRevisions,
  postRevisions,
  posts,
  postTags,
  tags,
  tagRequests,
  tagRevisions,
} from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import DropdownSelect from '@/components/ui/dropdown-select';
import TimeStamp from '@/components/ui/time-stamp';
import { Inbox, Shield } from 'lucide-react';
import Link from 'next/link';

export default async function AdminHome({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sessionPageSize = 20;
  const sessionPageParam = Array.isArray(searchParams?.sessionsPage)
    ? searchParams?.sessionsPage[0]
    : searchParams?.sessionsPage;
  const sessionPage = Math.max(
    1,
    Number.parseInt(sessionPageParam ?? '1', 10) || 1
  );
  const sessionOffset = (sessionPage - 1) * sessionPageSize;
  const baseSessionParams = new URLSearchParams();
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string') {
        baseSessionParams.set(key, value);
      }
    }
  }
  const buildSessionsUrl = (page: number) => {
    const params = new URLSearchParams(baseSessionParams);
    if (page <= 1) {
      params.delete('sessionsPage');
    } else {
      params.set('sessionsPage', String(page));
    }
    const query = params.toString();
    return query ? `/admin?${query}` : '/admin';
  };
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
    topHeat: [] as { path: string; totalDuration: number }[],
    tagHeat: [] as { name: string; slug: string; totalDuration: number }[],
    searchHeat: [] as { label: string; searches: number }[],
    topTransitions: [] as { source: string; target: string; transitions: number }[],
  };
  let featureSummary: {
    postCount: number;
    tagCount: number;
    updatedAt: Date | string | null;
    sourceFrom: Date | string | null;
    sourceTo: Date | string | null;
  } | null = null;
  let recentSessions: Array<{
    id: string;
    ipHash: string;
    country: string | null;
    region: string | null;
    city: string | null;
    os: string | null;
    browser: string | null;
    startedAt: Date | string;
    lastSeenAt: Date | string;
    pageviews: number;
    totalDuration: number;
    entryPath: string | null;
    exitPath: string | null;
  }> = [];
  let recentSessionsTotal = 0;

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

    const topHeat = await db
      .select({
        path: analyticsPageviews.path,
        totalDuration: sql<number>`sum(${analyticsPageviews.durationMs})`.mapWith(Number),
      })
      .from(analyticsPageviews)
      .where(
        and(
          gt(analyticsPageviews.startedAt, since),
          isNotNull(analyticsPageviews.durationMs)
        )
      )
      .groupBy(analyticsPageviews.path)
      .orderBy(desc(sql`sum(${analyticsPageviews.durationMs})`))
      .limit(5);

    const tagHeatRows = await db.execute(sql`
      SELECT t.name, t.slug, COALESCE(SUM(pv.duration_ms), 0)::int AS total_duration
      FROM ${analyticsPageviews} pv
      JOIN ${posts} p
        ON p.slug = split_part(split_part(pv.path, '?', 1), '/posts/', 2)
      JOIN ${postTags} pt ON pt.post_id = p.id
      JOIN ${tags} t ON t.id = pt.tag_id
      WHERE pv.started_at >= ${since}
        AND pv.duration_ms IS NOT NULL
        AND pv.path LIKE '/posts/%'
      GROUP BY t.id
      ORDER BY total_duration DESC
      LIMIT 5;
    `);

    const searchRollupRows = await db.execute(sql`
      SELECT term, SUM(searches)::int AS searches
      FROM ${analyticsSearchRollups}
      WHERE day >= ${since}
      GROUP BY term
      ORDER BY searches DESC
      LIMIT 8;
    `);

    const searchHeatRows =
      (searchRollupRows.rows ?? []).length > 0
        ? searchRollupRows
        : await db.execute(sql`
            SELECT label, COUNT(*)::int AS searches
            FROM ${analyticsEvents}
            WHERE created_at >= ${since}
              AND event_type = 'SEARCH'
              AND label IS NOT NULL
            GROUP BY label
            ORDER BY searches DESC
            LIMIT 8;
          `);

    const transitionRows = await db.execute(sql`
      WITH ordered AS (
        SELECT
          session_id,
          path,
          LEAD(path) OVER (PARTITION BY session_id ORDER BY started_at) AS next_path
        FROM ${analyticsPageviews}
        WHERE started_at >= ${since}
      )
      SELECT
        path AS source,
        next_path AS target,
        COUNT(*)::int AS transitions
      FROM ordered
      WHERE next_path IS NOT NULL
      GROUP BY source, target
      ORDER BY transitions DESC
      LIMIT 8;
    `);

    const featureRows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE entity_type = 'post')::int AS post_count,
        COUNT(*) FILTER (WHERE entity_type = 'tag')::int AS tag_count,
        MAX(updated_at) AS updated_at,
        MIN(source_from) AS source_from,
        MAX(source_to) AS source_to
      FROM ${analyticsFeatureVectors};
    `);

    const sessionRows = await db.execute(sql`
      SELECT
        s.id,
        s.ip_hash,
        s.country,
        s.region,
        s.city,
        s.os,
        s.browser,
        s.started_at,
        s.last_seen_at,
        COUNT(p.id)::int AS pageviews,
        COALESCE(SUM(p.duration_ms), 0)::int AS total_duration,
        (
          SELECT p2.path
          FROM ${analyticsPageviews} p2
          WHERE p2.session_id = s.id
          ORDER BY p2.started_at ASC
          LIMIT 1
        ) AS entry_path,
        (
          SELECT p3.path
          FROM ${analyticsPageviews} p3
          WHERE p3.session_id = s.id
          ORDER BY p3.started_at DESC
          LIMIT 1
        ) AS exit_path
      FROM ${analyticsSessions} s
      LEFT JOIN ${analyticsPageviews} p ON p.session_id = s.id
      WHERE s.started_at >= ${since}
      GROUP BY s.id
      ORDER BY s.last_seen_at DESC
      LIMIT ${sessionPageSize} OFFSET ${sessionOffset};
    `);

    stats = {
      sessions: sessions?.count ?? 0,
      pageviews: pageviews?.count ?? 0,
      uniqueVisitors: uniqueVisitors?.count ?? 0,
      avgDurationMs: avgDuration?.avg ?? 0,
      bounceRate,
      topPages,
      topHeat,
      tagHeat: (tagHeatRows.rows ?? []).map((row) => ({
        name: String(row.name ?? ''),
        slug: String(row.slug ?? ''),
        totalDuration: Number(row.total_duration ?? 0),
      })),
      searchHeat: (searchHeatRows.rows ?? []).map((row) => ({
        label: String((row as { label?: string; term?: string }).label ?? (row as { term?: string }).term ?? ''),
        searches: Number(row.searches ?? 0),
      })),
      topTransitions: (transitionRows.rows ?? []).map((row) => ({
        source: String(row.source ?? ''),
        target: String(row.target ?? ''),
        transitions: Number(row.transitions ?? 0),
      })),
    };
    recentSessionsTotal = sessions?.count ?? 0;
    const summaryRow = featureRows.rows?.[0] as
      | {
          post_count?: number;
          tag_count?: number;
          updated_at?: Date | string | null;
          source_from?: Date | string | null;
          source_to?: Date | string | null;
        }
      | undefined;
    if (summaryRow) {
      featureSummary = {
        postCount: Number(summaryRow.post_count ?? 0),
        tagCount: Number(summaryRow.tag_count ?? 0),
        updatedAt: summaryRow.updated_at ?? null,
        sourceFrom: summaryRow.source_from ?? null,
        sourceTo: summaryRow.source_to ?? null,
      };
    }
    recentSessions = (sessionRows.rows ?? []).map((row) => ({
      id: String(row.id),
      ipHash: String(row.ip_hash ?? ''),
      country: row.country ? String(row.country) : null,
      region: row.region ? String(row.region) : null,
      city: row.city ? String(row.city) : null,
      os: row.os ? String(row.os) : null,
      browser: row.browser ? String(row.browser) : null,
      startedAt: row.started_at as Date | string,
      lastSeenAt: row.last_seen_at as Date | string,
      pageviews: Number(row.pageviews ?? 0),
      totalDuration: Number(row.total_duration ?? 0),
      entryPath: row.entry_path ? String(row.entry_path) : null,
      exitPath: row.exit_path ? String(row.exit_path) : null,
    }));
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
  const totalSessionPages = Math.max(
    1,
    Math.ceil(recentSessionsTotal / sessionPageSize)
  );
  const canPrevSessions = sessionPage > 1;
  const canNextSessions = sessionPage < totalSessionPages;

  const now = new Date();
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFrom = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);

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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">Top Pages</div>
              {stats.topPages.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No traffic recorded yet.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {stats.topPages.map((page) => (
                    <div
                      key={page.path}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/60 pb-2"
                    >
                      <span className="truncate pr-4">{page.path}</span>
                      <span className="min-w-0 text-zinc-400 truncate">{page.views}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Global Heat (Time Spent)
              </div>
              {stats.topHeat.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No duration data yet.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {stats.topHeat.map((page) => (
                    <div
                      key={page.path}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/60 pb-2"
                    >
                      <span className="truncate pr-4">{page.path}</span>
                      <span className="min-w-0 text-zinc-400 truncate">
                        {formatDuration(page.totalDuration)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Tag Heat (Time Spent)
              </div>
              {stats.tagHeat.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No tag data yet.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {stats.tagHeat.map((tag) => (
                    <div
                      key={tag.slug}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/60 pb-2"
                    >
                      <span className="truncate pr-4">{tag.name}</span>
                      <span className="text-zinc-400">
                        {formatDuration(tag.totalDuration)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!analyticsError && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Search Heat (Top Queries)
              </div>
              {stats.searchHeat.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No search events yet.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {stats.searchHeat.map((row, index) => (
                    <div
                      key={`${row.label}-${index}`}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/60 pb-2"
                    >
                      <span className="truncate pr-4">{row.label}</span>
                      <span className="text-zinc-400">{row.searches}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Top Path Transitions (Sankey)
              </div>
              {stats.topTransitions.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  No transitions recorded yet.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {stats.topTransitions.map((row, index) => (
                    <div
                      key={`${row.source}-${row.target}-${index}`}
                      className="flex min-w-0 items-center justify-between gap-3 border-b border-zinc-800/60 pb-2"
                    >
                      <span className="truncate pr-4">
                        {row.source} → {row.target}
                      </span>
                      <span className="text-zinc-400">
                        {row.transitions}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
              <div className="text-xs uppercase text-zinc-500">
                Recommendation Feature Vectors
              </div>
              {featureSummary ? (
                <div className="space-y-3 text-sm text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>Post vectors</span>
                    <span>{featureSummary.postCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tag vectors</span>
                    <span>{featureSummary.tagCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Last rebuild</span>
                    <span>
                      {featureSummary.updatedAt ? (
                        <TimeStamp value={featureSummary.updatedAt} />
                      ) : (
                        "--"
                      )}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Source window:{" "}
                    {featureSummary.sourceFrom ? (
                      <TimeStamp value={featureSummary.sourceFrom} />
                    ) : (
                      "all time"
                    )}{" "}
                    →{" "}
                    {featureSummary.sourceTo ? (
                      <TimeStamp value={featureSummary.sourceTo} />
                    ) : (
                      "--"
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  No feature vectors generated yet.
                </div>
              )}
              <form
                action="/api/admin/analytics/rebuild-features"
                method="POST"
                target="_blank"
                className="space-y-2 text-xs"
              >
                <DropdownSelect
                  name="rangeDays"
                  defaultValue=""
                  className="min-w-0"
                  options={[
                    { label: "All time", value: "" },
                    { label: "Last 30 days", value: "30" },
                    { label: "Last 90 days", value: "90" },
                    { label: "Last 365 days", value: "365" },
                  ]}
                />
                <button
                  type="submit"
                  className="w-full border border-[#00ff41]/40 px-3 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  Rebuild Vectors
                </button>
              </form>
              <p className="text-[11px] text-zinc-500">
                Rebuilds post/tag feature vectors for recommendations.
              </p>
            </div>
          </div>
        )}

        {!analyticsError && (
          <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
            <div className="text-xs uppercase text-zinc-500">Export Analytics CSV</div>
            <form
              action="/api/admin/analytics/export"
              method="GET"
              className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm"
            >
              <DropdownSelect
                name="type"
                defaultValue="sessions"
                className="min-w-0"
                options={[
                  { label: "Sessions", value: "sessions" },
                  { label: "Pageviews", value: "pageviews" },
                  { label: "Events", value: "events" },
                ]}
              />
              <input
                type="date"
                name="from"
                defaultValue={defaultFrom}
                className="min-w-0 border border-zinc-800 bg-transparent px-3 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400 outline-none focus:border-[color:var(--accent)]"
              />
              <input
                type="date"
                name="to"
                defaultValue={defaultTo}
                className="min-w-0 border border-zinc-800 bg-transparent px-3 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400 outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="submit"
                className="border border-[#00ff41]/40 px-3 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
              >
                Export CSV
              </button>
            </form>
            <p className="text-xs text-zinc-500">
              Exports are filtered by the date range you select.
            </p>
          </div>
        )}

        {!analyticsError && (
          <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 space-y-4">
            <div className="text-xs uppercase text-zinc-500">Search Rollup</div>
            <form
              action="/api/admin/analytics/rollup"
              method="POST"
              target="_blank"
              className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm"
            >
              <DropdownSelect
                name="rangeDays"
                defaultValue="30"
                className="min-w-0"
                options={[
                  { label: "Last 7 days", value: "7" },
                  { label: "Last 30 days", value: "30" },
                  { label: "Last 90 days", value: "90" },
                  { label: "Last 365 days", value: "365" },
                ]}
              />
              <input
                type="number"
                name="retentionDays"
                min={7}
                defaultValue={90}
                className="min-w-0 border border-zinc-800 bg-transparent px-3 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400 outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="submit"
                className="border border-[#00ff41]/40 px-3 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
              >
                Roll Up
              </button>
            </form>
            <p className="text-xs text-zinc-500">
              Aggregates SEARCH events and prunes raw SEARCH rows older than the retention window.
            </p>
          </div>
        )}
      </section>

      {!analyticsError && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
              <Shield className="h-4 w-4" />
              Recent Sessions (Last 30 Days)
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 break-all">
              Showing {recentSessions.length} of {recentSessionsTotal} sessions
            </div>
          </div>
          {recentSessions.length === 0 ? (
            <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40 text-sm text-zinc-500">
              No session data yet.
            </div>
          ) : (
            <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                <span>Session</span>
                <span>Area</span>
                <span>Device</span>
                <span>Pages</span>
                <span>Duration</span>
                <span>Last Seen</span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {recentSessions.map((session) => {
                  const area = [session.city, session.region, session.country]
                    .filter(Boolean)
                    .join(', ');
                  const isBounce =
                    session.pageviews === 1 && session.totalDuration < 15000;
                  return (
                    <div
                      key={session.id}
                      className="grid min-w-0 grid-cols-1 gap-4 px-4 py-3 text-sm lg:grid-cols-6"
                    >
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/admin/analytics/${session.id}`}
                          className="text-[color:var(--accent)] hover:underline"
                        >
                          {session.ipHash.slice(0, 10)}…
                        </Link>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 break-all">
                          {session.entryPath ?? '--'} → {session.exitPath ?? '--'}
                        </div>
                        {isBounce && (
                          <div className="text-[10px] uppercase tracking-[0.3em] text-red-400">
                            Bounce
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 text-zinc-400 truncate">
                        {area || '--'}
                      </div>
                      <div className="min-w-0 text-zinc-400 truncate">
                        {session.os ?? '--'} · {session.browser ?? '--'}
                      </div>
                      <div className="text-zinc-400">
                        {session.pageviews}
                      </div>
                      <div className="text-zinc-400">
                        {formatDuration(session.totalDuration)}
                      </div>
                      <div className="text-zinc-400">
                        <TimeStamp value={session.lastSeenAt} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                <span>
                  Page {sessionPage} of {totalSessionPages}
                </span>
                <div className="flex items-center gap-2">
                  {canPrevSessions ? (
                    <Link
                      href={buildSessionsUrl(sessionPage - 1)}
                      className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-[#00ff41] hover:text-[#00ff41] transition"
                    >
                      Prev
                    </Link>
                  ) : (
                    <span className="border border-zinc-800 px-2 py-1 text-zinc-600">
                      Prev
                    </span>
                  )}
                  {canNextSessions ? (
                    <Link
                      href={buildSessionsUrl(sessionPage + 1)}
                      className="border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-[#00ff41] hover:text-[#00ff41] transition"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="border border-zinc-800 px-2 py-1 text-zinc-600">
                      Next
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

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
