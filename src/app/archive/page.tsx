import Link from 'next/link';
import { and, desc, eq, not } from 'drizzle-orm';
import { db } from '@/db';
import { posts } from '@/db/schema';
import EmptyState from '@/components/ui/empty-state';
import { Activity, Archive, Inbox } from 'lucide-react';
import { getTheme } from '@/lib/theme';
import SiteHeader from '@/components/site-header';
import { getViewer } from '@/lib/viewer';
import StatusPill from '@/components/ui/status-pill';
import TimeStamp from '@/components/ui/time-stamp';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatKey(value: Date | string | null) {
  if (!value) return '----.--.--';
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonthLabel(value: Date) {
  return `${MONTHS[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

export default async function ArchivePage() {
  const theme = getTheme();
  const { viewer, session } = await getViewer();
  const viewerId = session?.user?.id ?? null;
  const publishedPosts = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.status, 'published'))
    .orderBy(desc(posts.publishedAt));

  const mySubmissions = viewerId
    ? await db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          status: posts.status,
          createdAt: posts.createdAt,
        })
        .from(posts)
        .where(and(eq(posts.authorId, viewerId), not(eq(posts.status, 'published'))))
        .orderBy(desc(posts.createdAt))
    : [];

  const grouped = new Map<string, typeof publishedPosts>();
  for (const post of publishedPosts) {
    const key = formatKey(post.publishedAt);
    const list = grouped.get(key) ?? [];
    list.push(post);
    grouped.set(key, list);
  }

  const dates = Array.from(grouped.keys());

  const dayCounts = new Map<string, number>();
  publishedPosts.forEach((post) => {
    const key = post.publishedAt
      ? dateKey(new Date(post.publishedAt))
      : dateKey(new Date());
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  });

  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  const startOffset = (start.getUTCDay() + 6) % 7;

  const days: { key: string; count: number; date: Date }[] = [];
  for (let i = 0; i < 365; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    const key = dateKey(current);
    days.push({ key, count: dayCounts.get(key) ?? 0, date: current });
  }

  const weekCount = Math.ceil((days.length + startOffset) / 7);
  const trailing = weekCount * 7 - (days.length + startOffset);
  const cellSize = 12;
  const cellGap = 4;
  const monthLabels = Array.from({ length: weekCount }, () => '');
  const seenMonths = new Set<string>();
  for (let w = 0; w < weekCount; w += 1) {
    const index = w * 7 - startOffset;
    if (index < 0 || index >= days.length) continue;
    const date = days[index].date;
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
    if (!seenMonths.has(key)) {
      seenMonths.add(key);
      monthLabels[w] = MONTHS[date.getUTCMonth()];
    }
  }

  const monthGroups = new Map<
    string,
    { label: string; posts: { id: string; slug: string; title: string; date: Date | null }[] }
  >();
  publishedPosts.forEach((post) => {
    const date = post.publishedAt ? new Date(post.publishedAt) : new Date();
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    const entry = monthGroups.get(key) ?? {
      label: formatMonthLabel(date),
      posts: [],
    };
    entry.posts.push({
      id: post.id,
      slug: post.slug,
      title: post.title,
      date: post.publishedAt ? new Date(post.publishedAt) : null,
    });
    monthGroups.set(key, entry);
  });

  const sortedMonths = Array.from(monthGroups.entries()).sort((a, b) =>
    a[0] > b[0] ? -1 : 1
  );

  let peakDay = '';
  let peakCount = 0;
  dayCounts.forEach((count, key) => {
    if (count > peakCount) {
      peakCount = count;
      peakDay = key;
    }
  });

  return (
    <div className="min-h-screen app-bg">
      <SiteHeader viewer={viewer} initialTheme={theme} active="archive" />
      <div className="max-w-screen-xl mx-auto space-y-10 px-6 pt-24 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
              <Archive className="h-4 w-4" />
              Archive
            </div>
            <h1 className="mt-4 text-4xl font-black">Signal Timeline</h1>
            <p className="mt-3 app-muted-strong">
              A live view of publication activity with daily intensity and month-level threads.
            </p>
          </div>
          <div className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Published</div>
                <div className="mt-2 text-2xl font-black app-text">{publishedPosts.length}</div>
              </div>
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Active Days</div>
                <div className="mt-2 text-2xl font-black app-text">{dayCounts.size}</div>
              </div>
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Peak Day</div>
                <div className="mt-2 text-sm font-semibold app-text">
                  {peakDay ? <TimeStamp value={peakDay} /> : '--'}
                </div>
              </div>
              <div className="border app-border panel-bg p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">Peak Count</div>
                <div className="mt-2 text-2xl font-black app-text">{peakCount}</div>
              </div>
            </div>
          </div>
        </div>

        {mySubmissions.length > 0 && (
          <section className="space-y-3">
            <div className="text-xs uppercase tracking-[0.4em] app-muted">
              Your submissions
            </div>
            <div className="space-y-3">
              {mySubmissions.map((post) => (
                <div key={post.id} className="border app-border panel-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/posts/${post.slug}`}
                     
                      className="text-sm font-semibold app-text hover:text-[#00ff41] transition"
                    >
                      {post.title}
                    </Link>
                    <StatusPill
                      status={post.status}
                      label={post.status === 'pending' ? 'Pending Review' : 'Rejected'}
                    />
                  </div>
                  <div className="mt-2 text-xs app-muted">
                    Submitted <TimeStamp value={post.createdAt} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {dates.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="No archived posts"
            description="Once posts are published, they will appear here by date."
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
          <div className="space-y-10">
            <section className="border app-border panel-bg p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
                  <Activity className="h-4 w-4" />
                  Activity Heatmap
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                  Last 12 months
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="overflow-x-auto pb-2">
                  <div className="min-w-max w-max mx-auto space-y-3">
                    <div className="flex gap-3">
                      <div className="w-8"></div>
                      <div
                        className="grid text-[10px] uppercase tracking-[0.3em] app-muted"
                        style={{
                          gridTemplateColumns: `repeat(${weekCount}, ${cellSize}px)`,
                          columnGap: `${cellGap}px`,
                        }}
                      >
                        {monthLabels.map((label, index) => (
                          <div key={`month-${index}`} className="text-center">
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="grid w-8 grid-rows-7 gap-1 text-[9px] uppercase tracking-[0.3em] app-muted">
                        <div>Mon</div>
                        <div></div>
                        <div>Wed</div>
                        <div></div>
                        <div>Fri</div>
                        <div></div>
                        <div>Sun</div>
                      </div>
                      <div
                        className="grid"
                        style={{
                          gridAutoFlow: 'column',
                          gridAutoColumns: `${cellSize}px`,
                          gridTemplateRows: `repeat(7, ${cellSize}px)`,
                          columnGap: `${cellGap}px`,
                          rowGap: `${cellGap}px`,
                        }}
                      >
                        {Array.from({ length: startOffset }).map((_, index) => (
                          <div key={`pad-${index}`} className="h-3 w-3" />
                        ))}
                        {days.map((day) => {
                          let color = 'bg-[color:var(--heat-0)]';
                          if (day.count >= 4) color = 'bg-[color:var(--heat-4)]';
                          else if (day.count === 3) color = 'bg-[color:var(--heat-3)]';
                          else if (day.count === 2) color = 'bg-[color:var(--heat-2)]';
                          else if (day.count === 1) color = 'bg-[color:var(--heat-1)]';
                          return (
                            <div
                              key={day.key}
                              title={`${day.key} · ${day.count} posts`}
                              className={`h-3 w-3 rounded-[3px] border app-border ${color}`}
                            />
                          );
                        })}
                        {Array.from({ length: trailing }).map((_, index) => (
                          <div key={`trail-${index}`} className="h-3 w-3" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] app-muted">
                  <span>Less</span>
                  <div className="h-3 w-3 border app-border bg-[color:var(--heat-0)]"></div>
                  <div className="h-3 w-3 border app-border bg-[color:var(--heat-1)]"></div>
                  <div className="h-3 w-3 border app-border bg-[color:var(--heat-2)]"></div>
                  <div className="h-3 w-3 border app-border bg-[color:var(--heat-3)]"></div>
                  <div className="h-3 w-3 border app-border bg-[color:var(--heat-4)]"></div>
                  <span>More</span>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.4em] app-muted">
                  Monthly threads
                </div>
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                  {dates.length} active days
                </div>
              </div>
              <div className="space-y-4">
                {sortedMonths.map(([key, month]) => (
                    <details key={key} className="border app-border panel-bg p-5 open:border-[color:var(--accent)]/40">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between">
                          <div className="text-sm uppercase tracking-[0.3em] app-text">
                            {month.label}
                          </div>
                          <div className="text-xs app-muted">
                            {month.posts.length} posts
                          </div>
                        </div>
                      </summary>
                    <div className="mt-4 relative">
                      <span className="absolute left-3 top-0 bottom-0 w-px bg-[color:var(--heat-2)]"></span>
                      <div className="space-y-4">
                        {month.posts.map((post) => (
                          <div key={post.id} className="grid grid-cols-[24px_1fr] gap-4">
                            <div className="relative">
                              <span className="absolute left-3 top-2 h-2 w-2 -translate-x-1/2 rounded-full bg-[color:var(--heat-4)] ring-2 ring-[color:var(--panel-bg)]"></span>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                                <TimeStamp value={post.date} />
                              </div>
                              <Link
                                href={`/posts/${post.slug}`}
                               
                                className="mt-1 inline-block app-text hover:text-[color:var(--accent)] transition"
                              >
                                {post.title}
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
