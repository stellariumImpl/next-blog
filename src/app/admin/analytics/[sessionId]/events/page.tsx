import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { analyticsEvents, analyticsSessions } from "@/db/schema";
import { Shield } from "lucide-react";

const formatTime = (value: Date | string | null) => {
  if (!value) return "--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("en-US", { hour12: false });
};

export default async function SessionEventsPage({
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

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(eq(analyticsEvents.sessionId, sessionId))
    .orderBy(desc(analyticsEvents.createdAt));

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
          Events Detail
        </div>
        <h1 className="mt-3 text-2xl font-semibold">Session {session.id}</h1>
      </div>

      <div className="border border-zinc-800 rounded bg-zinc-900/40 overflow-hidden">
        <div className="border-b border-zinc-800/60 px-4 py-3 text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Events
        </div>
        <div className="divide-y divide-zinc-800/60">
          {events.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">
              No events recorded.
            </div>
          ) : (
            events.map((event) => (
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
  );
}
