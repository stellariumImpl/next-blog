CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"page_id" text,
	"path" text NOT NULL,
	"event_type" text NOT NULL,
	"label" text,
	"target" text,
	"href" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "analytics_events_session_idx" ON "analytics_events" ("session_id");
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" ("created_at");
