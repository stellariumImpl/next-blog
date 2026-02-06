CREATE TABLE "analytics_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"ip_hash" text NOT NULL,
	"country" text,
	"region" text,
	"city" text,
	"os" text,
	"browser" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "analytics_sessions_last_seen_idx" ON "analytics_sessions" ("last_seen_at");
CREATE INDEX "analytics_sessions_ip_hash_idx" ON "analytics_sessions" ("ip_hash");

CREATE TABLE "analytics_pageviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_ms" integer
);

CREATE UNIQUE INDEX "analytics_pageviews_page_id_idx" ON "analytics_pageviews" ("page_id");
CREATE INDEX "analytics_pageviews_session_idx" ON "analytics_pageviews" ("session_id");
CREATE INDEX "analytics_pageviews_started_idx" ON "analytics_pageviews" ("started_at");
