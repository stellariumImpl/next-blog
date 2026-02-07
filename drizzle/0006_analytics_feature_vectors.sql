CREATE TYPE "analytics_entity" AS ENUM ('post', 'tag');

CREATE TABLE "analytics_feature_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "analytics_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"features" jsonb NOT NULL,
	"source_from" timestamp with time zone,
	"source_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "analytics_feature_vectors_entity_idx" ON "analytics_feature_vectors" ("entity_type", "entity_id");
CREATE INDEX "analytics_feature_vectors_updated_idx" ON "analytics_feature_vectors" ("updated_at");
