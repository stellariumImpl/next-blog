import Link from 'next/link';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { requireUser } from '@/lib/auth-guard';
import { db } from '@/db';
import {
  analyticsPageviews,
  analyticsSessions,
  comments,
  posts,
  postRevisions,
  tagRequests,
  tags,
  user,
} from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import StatusPill from '@/components/ui/status-pill';
import { Inbox, User } from 'lucide-react';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { ensureUserProfile } from '@/lib/user-profile';
import TimeStamp from '@/components/ui/time-stamp';

export default async function AccountPage() {
  const { session } = await requireUser();
  const userId = session.user.id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const theme = getTheme();
  const isDark = theme === 'dark';
  const viewerProfile = session?.user
    ? await ensureUserProfile({ id: session.user.id, email: session.user.email })
    : null;
  const viewer = session?.user
    ? {
        email: session.user.email,
        role: viewerProfile?.role ?? 'user',
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;

  let analyticsError: string | null = null;
  let analyticsSummary = {
    sessions: 0,
    pageviews: 0,
    avgDurationMs: 0,
    topPages: [] as { path: string; views: number }[],
  };
  let recentSessions: Array<{
    id: string;
    country: string | null;
    region: string | null;
    city: string | null;
    os: string | null;
    browser: string | null;
    startedAt: Date | string;
    lastSeenAt: Date | string;
    pageviews: number;
    totalDuration: number;
  }> = [];

  const [userRow, myPosts, myComments, myTagRequests, myPostRevisions, approvedTags] =
    await Promise.all([
      db
        .select({ createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
    db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        status: posts.status,
        createdAt: posts.createdAt,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt)),
    db
      .select({
        id: comments.id,
        body: comments.body,
        status: comments.status,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.authorId, userId))
      .orderBy(desc(comments.createdAt)),
    db
      .select({
        id: tagRequests.id,
        name: tagRequests.name,
        slug: tagRequests.slug,
        status: tagRequests.status,
        createdAt: tagRequests.createdAt,
      })
      .from(tagRequests)
      .where(eq(tagRequests.requestedBy, userId))
      .orderBy(desc(tagRequests.createdAt)),
    db
      .select({
        id: postRevisions.id,
        postId: postRevisions.postId,
        status: postRevisions.status,
        createdAt: postRevisions.createdAt,
        title: posts.title,
        slug: posts.slug,
      })
      .from(postRevisions)
      .innerJoin(posts, eq(postRevisions.postId, posts.id))
      .where(eq(postRevisions.authorId, userId))
      .orderBy(desc(postRevisions.createdAt)),
    db.select({ slug: tags.slug }).from(tags),
  ]);
  const tagSlugSet = new Set(approvedTags.map((tag) => tag.slug));
  const userCreatedAt = userRow?.[0]?.createdAt ?? null;

  try {
    const [sessionCount] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(analyticsSessions)
      .where(and(eq(analyticsSessions.userId, userId), gt(analyticsSessions.startedAt, since)))
      .limit(1);

    const pageviewRows = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM ${analyticsPageviews} p
      INNER JOIN ${analyticsSessions} s ON s.id = p.session_id
      WHERE s.user_id = ${userId}
        AND p.started_at >= ${since};
    `);

    const avgRows = await db.execute(sql`
      SELECT COALESCE(AVG(p.duration_ms), 0)::int AS avg
      FROM ${analyticsPageviews} p
      INNER JOIN ${analyticsSessions} s ON s.id = p.session_id
      WHERE s.user_id = ${userId}
        AND p.started_at >= ${since}
        AND p.duration_ms IS NOT NULL;
    `);

    const topPageRows = await db.execute(sql`
      SELECT p.path, COUNT(*)::int AS views
      FROM ${analyticsPageviews} p
      INNER JOIN ${analyticsSessions} s ON s.id = p.session_id
      WHERE s.user_id = ${userId}
        AND p.started_at >= ${since}
      GROUP BY p.path
      ORDER BY views DESC
      LIMIT 5;
    `);

    const sessionRows = await db.execute(sql`
      SELECT
        s.id,
        s.country,
        s.region,
        s.city,
        s.os,
        s.browser,
        s.started_at,
        s.last_seen_at,
        COUNT(p.id)::int AS pageviews,
        COALESCE(SUM(p.duration_ms), 0)::int AS total_duration
      FROM ${analyticsSessions} s
      LEFT JOIN ${analyticsPageviews} p ON p.session_id = s.id
      WHERE s.user_id = ${userId}
        AND s.started_at >= ${since}
      GROUP BY s.id
      ORDER BY s.last_seen_at DESC
      LIMIT 10;
    `);

    analyticsSummary = {
      sessions: sessionCount?.count ?? 0,
      pageviews: Number(pageviewRows.rows?.[0]?.count ?? 0),
      avgDurationMs: Number(avgRows.rows?.[0]?.avg ?? 0),
      topPages: (topPageRows.rows ?? []).map((row) => ({
        path: String(row.path ?? ''),
        views: Number(row.views ?? 0),
      })),
    };

    recentSessions = (sessionRows.rows ?? []).map((row) => ({
      id: String(row.id),
      country: row.country ? String(row.country) : null,
      region: row.region ? String(row.region) : null,
      city: row.city ? String(row.city) : null,
      os: row.os ? String(row.os) : null,
      browser: row.browser ? String(row.browser) : null,
      startedAt: row.started_at as Date | string,
      lastSeenAt: row.last_seen_at as Date | string,
      pageviews: Number(row.pageviews ?? 0),
      totalDuration: Number(row.total_duration ?? 0),
    }));
  } catch (error) {
    analyticsError = error instanceof Error ? error.message : 'Analytics unavailable.';
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
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} />
      <div className="max-w-4xl mx-auto space-y-10 px-6 pt-24 pb-24">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
            <User className="h-4 w-4" />
            Profile
          </div>
          <h1 className="mt-4 text-4xl font-black">Your Profile</h1>
          <p className="mt-3 app-muted-strong">
            A private view of your activity, submissions, and usage insights.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Profile Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border app-border panel-bg p-4">
              <div className="text-xs uppercase tracking-[0.3em] app-muted">Identity</div>
              <div className="mt-2 text-lg font-semibold app-text">
                {session.user.name ?? 'Member'}
              </div>
              <div className="mt-1 text-xs app-muted break-all">{session.user.email}</div>
            </div>
            <div className="border app-border panel-bg p-4">
              <div className="text-xs uppercase tracking-[0.3em] app-muted">Role</div>
              <div className="mt-2 text-lg font-semibold app-text">
                {viewer?.role === 'admin' ? 'Admin' : 'Member'}
              </div>
              <div className="mt-1 text-xs app-muted">Private profile</div>
            </div>
            <div className="border app-border panel-bg p-4">
              <div className="text-xs uppercase tracking-[0.3em] app-muted">Member Since</div>
              <div className="mt-2 text-sm app-text">
                {userCreatedAt ? <TimeStamp value={userCreatedAt} /> : '--'}
              </div>
              <div className="mt-1 text-xs app-muted">Account creation date</div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your Analytics (Private)</h2>
            <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
              Last 30 Days
            </div>
          </div>
          {analyticsError ? (
            <div className="border app-border panel-bg p-4 text-sm text-red-400">
              {analyticsError}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">Sessions</div>
                  <div className="mt-2 text-2xl font-black app-text">
                    {analyticsSummary.sessions}
                  </div>
                </div>
                <div className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">Pageviews</div>
                  <div className="mt-2 text-2xl font-black app-text">
                    {analyticsSummary.pageviews}
                  </div>
                </div>
                <div className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">
                    Avg Session Duration
                  </div>
                  <div className="mt-2 text-2xl font-black app-text">
                    {formatDuration(analyticsSummary.avgDurationMs)}
                  </div>
                </div>
              </div>

              <div className="border app-border panel-bg p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] app-muted">
                  Top Pages You Visited
                </div>
                {analyticsSummary.topPages.length === 0 ? (
                  <div className="text-sm app-muted">No pageviews recorded yet.</div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {analyticsSummary.topPages.map((page) => (
                      <div key={page.path} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">{page.path}</span>
                        <span className="text-xs app-muted">{page.views} views</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border app-border panel-bg p-4 space-y-3">
                <div className="text-xs uppercase tracking-[0.3em] app-muted">
                  Recent Sessions
                </div>
                {recentSessions.length === 0 ? (
                  <div className="text-sm app-muted">No sessions recorded yet.</div>
                ) : (
                  <div className="space-y-3 text-sm">
                    {recentSessions.map((session) => {
                      const area = [session.city, session.region, session.country]
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <div
                          key={session.id}
                          className={`border ${
                            isDark ? 'border-zinc-800/50' : 'app-border/60'
                          } p-3`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs uppercase tracking-[0.3em] app-muted">
                              {session.os ?? '--'} · {session.browser ?? '--'}
                            </div>
                            <div className="text-xs app-muted">
                              <TimeStamp value={session.lastSeenAt} />
                            </div>
                          </div>
                          <div className="mt-2 text-xs app-muted">
                            {area || '--'} · {session.pageviews} pages ·{' '}
                            {formatDuration(session.totalDuration)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Posts</h2>
          {myPosts.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No submissions yet"
              description="Submit your first post to kick off your archive."
              action={
                <Link
                  href="/submit"
                 
                  className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  Submit a post
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {myPosts.map((post) => (
                <div key={post.id} className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">
                    {post.status}
                  </div>
                  <div className="mt-2 text-lg font-semibold app-text">{post.title}</div>
                  <div className="mt-1 text-xs app-muted">
                    Submitted <TimeStamp value={post.createdAt} />
                  </div>
                  {post.status === 'published' && (
                    <Link
                      href={`/posts/${post.slug}`}
                     
                      className="mt-3 inline-block text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:underline"
                    >
                      View post
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Post Updates</h2>
          {myPostRevisions.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No updates submitted"
              description="Edits you request will appear here with their review status."
            />
          ) : (
            <div className="space-y-3">
              {myPostRevisions.map((revision) => (
                <div key={revision.id} className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${revision.slug}`}
                     
                      className="text-sm font-semibold app-text hover:text-[#00ff41] transition"
                    >
                      {revision.title}
                    </Link>
                    <StatusPill
                      status={revision.status}
                      label={
                        revision.status === 'pending'
                          ? 'Pending Review'
                          : revision.status === 'approved'
                            ? 'Applied'
                            : 'Rejected'
                      }
                    />
                  </div>
                  <div className="mt-2 text-xs app-muted">
                    Submitted <TimeStamp value={revision.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Comments</h2>
          {myComments.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No comments yet"
              description="Join the discussion on published posts."
            />
          ) : (
            <div className="space-y-3">
              {myComments.map((comment) => (
                <div key={comment.id} className="border app-border panel-bg p-4">
                  <div className="text-xs uppercase tracking-[0.3em] app-muted">
                    {comment.status}
                  </div>
                  <div className="mt-2 text-sm app-muted-strong whitespace-pre-line">
                    {comment.body}
                  </div>
                  <div className="mt-1 text-xs app-muted">
                    Submitted <TimeStamp value={comment.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your Tag Requests</h2>
          {myTagRequests.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No tag requests"
              description="Request new tags from the tag directory."
              action={
                <Link
                  href="/tags"
                 
                  className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                >
                  Browse tags
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myTagRequests.map((request) => {
                const resolved =
                  tagSlugSet.has(request.slug) && request.status !== 'approved';
                const pillStatus = resolved ? 'approved' : request.status;
                const label = resolved
                  ? 'Resolved'
                  : request.status === 'pending'
                    ? 'Pending Review'
                    : request.status === 'approved'
                      ? 'Approved'
                      : 'Rejected';
                return (
                  <div key={request.id} className="border app-border panel-bg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-lg font-semibold app-text">
                        {request.name}
                      </div>
                      <StatusPill status={pillStatus} label={label} />
                    </div>
                    <div className="mt-2 text-xs app-muted">/{request.slug}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
