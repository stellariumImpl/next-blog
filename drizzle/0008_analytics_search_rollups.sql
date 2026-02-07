CREATE TABLE "analytics_search_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"term" text NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"unique_sessions" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone
);

CREATE UNIQUE INDEX "analytics_search_rollups_day_term_idx" ON "analytics_search_rollups" ("day", "term");
CREATE INDEX "analytics_search_rollups_day_idx" ON "analytics_search_rollups" ("day");
