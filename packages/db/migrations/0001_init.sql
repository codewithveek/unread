CREATE TYPE "public"."chapter_source_role" AS ENUM('primary', 'also');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('planning', 'voicing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pipeline_step" AS ENUM('collect', 'extract', 'dedupe', 'plan', 'script', 'check', 'voice', 'cover', 'publish');--> statement-breakpoint
CREATE TYPE "public"."saved_item_kind" AS ENUM('link', 'email', 'rss');--> statement-breakpoint
CREATE TYPE "public"."saved_item_status" AS ENUM('queued', 'used', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."step_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text,
	"title" text NOT NULL,
	"outlet" text,
	"published_at" timestamp with time zone,
	"text_excerpt" text,
	"text_hash" text,
	"embedding" vector(768),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_sources" (
	"chapter_id" text NOT NULL,
	"article_id" text NOT NULL,
	"role" "chapter_source_role" DEFAULT 'primary' NOT NULL,
	CONSTRAINT "chapter_sources_chapter_id_article_id_pk" PRIMARY KEY("chapter_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"start_s" real NOT NULL,
	"end_s" real NOT NULL,
	"summary" text,
	"script" jsonb
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"status" "episode_status" DEFAULT 'planning' NOT NULL,
	"title" text,
	"duration_s" real,
	"audio_key" text,
	"cover_key" text,
	"transcript" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heard_articles" (
	"user_id" text NOT NULL,
	"article_id" text NOT NULL,
	"episode_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heard_articles_user_id_article_id_pk" PRIMARY KEY("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "rss_feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "saved_item_kind" NOT NULL,
	"url" text,
	"title" text,
	"raw_ref" text,
	"status" "saved_item_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" text NOT NULL,
	"step" "pipeline_step" NOT NULL,
	"status" "step_run_status" DEFAULT 'running' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"output_ref" text,
	"timings" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"query" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"auth0_sub" text NOT NULL,
	"email" text,
	"country" text DEFAULT 'US' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"delivery_time" text DEFAULT '07:00' NOT NULL,
	"episode_minutes" integer DEFAULT 15 NOT NULL,
	"voice_id" text DEFAULT 'af_heart' NOT NULL,
	"feed_token" text NOT NULL,
	"inbound_alias" text NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_episode_minutes_check" CHECK ("users"."episode_minutes" in (5, 15, 30)),
	CONSTRAINT "users_delivery_time_check" CHECK ("users"."delivery_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "chapter_sources" ADD CONSTRAINT "chapter_sources_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_sources" ADD CONSTRAINT "chapter_sources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_articles" ADD CONSTRAINT "heard_articles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_articles" ADD CONSTRAINT "heard_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_articles" ADD CONSTRAINT "heard_articles_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rss_feeds" ADD CONSTRAINT "rss_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_runs" ADD CONSTRAINT "step_runs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_url_key" ON "articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "articles_embedding_idx" ON "articles" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_episode_position_key" ON "chapters" USING btree ("episode_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_user_date_key" ON "episodes" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "rss_feeds_user_url_key" ON "rss_feeds" USING btree ("user_id","url");--> statement-breakpoint
CREATE INDEX "saved_items_user_status_idx" ON "saved_items" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "step_runs_episode_step_attempt_key" ON "step_runs" USING btree ("episode_id","step","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "user_topics_user_query_key" ON "user_topics" USING btree ("user_id",lower("query"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users" USING btree ("auth0_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_feed_token_key" ON "users" USING btree ("feed_token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_inbound_alias_key" ON "users" USING btree ("inbound_alias");