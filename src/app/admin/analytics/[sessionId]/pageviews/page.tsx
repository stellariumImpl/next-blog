import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { analyticsPageviews, analyticsSessions } from "@/db/schema";
import TimeStamp from "@/components/ui/time-stamp";
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

export default async function SessionPageviewsPage({
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

  const sequence = [...pageviews].sort(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/analytics/${sessionId}`}
          className="text-xs uppercase tracking-[0.3em] text-zinc-500 hover:text-[color:var(--accent)]"
        >
          ← Back to session overview
        </Link>
        <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-zinc-500">
          <Shield className="h-4 w-4" />
          Pageviews Detail
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Session {session.id}</h1>
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Page Sequence Timeline
        </div>
        <div className="divide-y divide-zinc-800/60">
          {sequence.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">
              No pageviews recorded for this session.
            </div>
          ) : (
            sequence.map((view) => (
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
              <div
                key={view.id}
                className="grid grid-cols-1 md:grid-cols-5 gap-4 px-4 py-3 text-sm"
              >
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
