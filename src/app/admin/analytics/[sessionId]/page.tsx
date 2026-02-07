import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsEvents, analyticsPageviews, analyticsSessions } from "@/db/schema";
import TimeStamp from "@/components/ui/time-stamp";
import Link from "next/link";
import { Shield } from "lucide-react";

const formatDuration = (ms: number | null) => {
  if (!ms || ms <= 0) return "--";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
};

const formatTime = (value: Date | string | null) => {
  if (!value) return "--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-US", { hour12: false });
};

export default async function SessionDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const sessionId = params.sessionId;
  const [session] = await db
    .select()
    .from(analyticsSessions)
    .where(eq(analyticsSessions.id, sessionId))
    .limit(1);

  if (!session) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin"
          className="text-xs uppercase tracking-[0.3em] text-zinc-500 hover:text-[color:var(--accent)]"
        >
          ← Back to overview
        </Link>
        <div className="border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
          Session not found.
        </div>
      </div>
    );
  }

  const pageviews = await db
    .select()
    .from(analyticsPageviews)
    .where(eq(analyticsPageviews.sessionId, sessionId))
    .orderBy(desc(analyticsPageviews.startedAt));

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.sessionId, sessionId))
    .orderBy(desc(analyticsEvents.createdAt));

  const heatRows = await db.execute(sql`
    SELECT path, COALESCE(SUM(duration_ms), 0)::int AS total_duration
    FROM ${analyticsPageviews}
    WHERE session_id = ${sessionId}
    GROUP BY path
    ORDER BY total_duration DESC
    LIMIT 5;
  `);

  const heatRanking = (heatRows.rows ?? []).map((row) => ({
    path: String(row.path ?? ""),
    totalDuration: Number(row.total_duration ?? 0),
  }));

  const area = [session.city, session.region, session.country]
    .filter(Boolean)
    .join(", ");

  const sequence = [...pageviews].sort(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const sequencePreview = sequence.slice(0, 10);
  const eventsPreview = events.slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="text-xs uppercase tracking-[0.3em] text-zinc-500 hover:text-[color:var(--accent)]"
        >
          ← Back to overview
        </Link>
        <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Shield className="h-4 w-4" />
          Session Detail
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Session {session.id}</h1>
        <p className="mt-2 text-zinc-400">
          {area || "Unknown area"} · {session.os ?? "Unknown OS"} ·{" "}
          {session.browser ?? "Unknown browser"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
          <div className="text-xs uppercase text-zinc-500">Started</div>
          <div className="mt-2 text-lg">
            <TimeStamp value={session.startedAt} />
          </div>
        </div>
        <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
          <div className="text-xs uppercase text-zinc-500">Last Seen</div>
          <div className="mt-2 text-lg">
            <TimeStamp value={session.lastSeenAt} />
          </div>
        </div>
        <div className="border border-zinc-800 rounded p-4 bg-zinc-900/40">
          <div className="text-xs uppercase text-zinc-500">Pageviews</div>
          <div className="mt-2 text-lg">{pageviews.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
          <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500 flex items-center justify-between">
            <span>Page Sequence Timeline</span>
            <Link
              href={`/admin/analytics/${sessionId}/pageviews`}
              className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--accent)] hover:underline"
            >
              View details
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {sequencePreview.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">
                No pageviews recorded for this session.
              </div>
            ) : (
              sequencePreview.map((view) => (
                  <div key={view.id} className="px-4 py-3 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{view.path}</span>
                      <span className="text-zinc-500">
                        {formatTime(view.startedAt)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatDuration(view.durationMs ?? null)} ·{" "}
                      {view.referrer || "no referrer"}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
          <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500 flex items-center justify-between">
            <span>Events</span>
            <Link
              href={`/admin/analytics/${sessionId}/events`}
              className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--accent)] hover:underline"
            >
              View details
            </Link>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {eventsPreview.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-500">
                No events recorded.
              </div>
            ) : (
              eventsPreview.map((event) => (
                <div key={event.id} className="px-4 py-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                        {event.eventType}
                      </span>
                      <span className="truncate">
                        {event.label || event.target || "Event"}
                      </span>
                    </div>
                    <span className="text-zinc-500">
                      {formatTime(event.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {event.path} {event.href ? `· ${event.href}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Path Flow
        </div>
        {sequence.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">
            No path flow recorded.
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto px-4 py-4 text-sm">
            {sequence.map((view, index) => (
              <div key={view.id} className="flex items-center gap-3">
                <div className="border border-zinc-800 rounded px-3 py-2 whitespace-nowrap text-zinc-300">
                  {view.path}
                </div>
                {index < sequence.length - 1 && (
                  <span className="text-zinc-600">→</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Heat Ranking (By Time Spent)
        </div>
        <div className="divide-y divide-zinc-800/60">
          {heatRanking.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">
              No duration data yet.
            </div>
          ) : (
            heatRanking.map((row, index) => (
              <div key={`${row.path}-${index}`} className="px-4 py-3 text-sm flex items-center justify-between gap-4">
                <span className="truncate">{row.path}</span>
                <span className="text-zinc-500">
                  {formatDuration(row.totalDuration)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <span>Path</span>
          <span>Referrer</span>
          <span>Duration</span>
          <span>Started</span>
          <span>Ended</span>
        </div>
        <div className="divide-y divide-zinc-800/60">
          {pageviews.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">
              No pageviews recorded for this session.
            </div>
          ) : (
            pageviews.map((view) => (
              <div key={view.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 px-4 py-3 text-sm">
                <span className="truncate">{view.path}</span>
                <span className="truncate text-zinc-400">
                  {view.referrer || "--"}
                </span>
                <span className="text-zinc-400">
                  {formatDuration(view.durationMs ?? null)}
                </span>
                <span className="text-zinc-400">
                  <TimeStamp value={view.startedAt} />
                </span>
                <span className="text-zinc-400">
                  <TimeStamp value={view.endedAt} />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
