CREATE TYPE "public"."cadence" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."chapter_source_role" AS ENUM('primary', 'also');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('planning', 'voicing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."inbound_kind" AS ENUM('issue', 'link', 'forwarding_confirmation', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."inbound_status" AS ENUM('received', 'processed', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_source_kind" AS ENUM('newsletter', 'link', 'news', 'rss');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('queued', 'used', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."listening_client" AS ENUM('web', 'feed');--> statement-breakpoint
CREATE TYPE "public"."listening_event" AS ENUM('play', 'skip', 'complete', 'seek');--> statement-breakpoint
CREATE TYPE "public"."news_mode" AS ENUM('always', 'fill');--> statement-breakpoint
CREATE TYPE "public"."newsletter_priority" AS ENUM('always', 'normal', 'if_room');--> statement-breakpoint
CREATE TYPE "public"."pipeline_step" AS ENUM('collect', 'extract', 'cluster', 'plan', 'script', 'check', 'voice', 'cover', 'publish');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'plus');--> statement-breakpoint
CREATE TYPE "public"."step_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "chapter_sources" (
	"chapter_id" text NOT NULL,
	"item_id" text NOT NULL,
	"role" "chapter_source_role" DEFAULT 'primary' NOT NULL,
	CONSTRAINT "chapter_sources_chapter_id_item_id_pk" PRIMARY KEY("chapter_id","item_id")
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
	"characters" integer,
	"voice_model" text,
	"cost_cents" integer,
	"audio_key" text,
	"cover_key" text,
	"transcript" jsonb,
	"error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heard_items" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"cluster_key" text NOT NULL,
	"episode_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "heard_items_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"newsletter_id" text,
	"message_id" text NOT NULL,
	"from_email" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject" text,
	"raw_key" text,
	"status" "inbound_status" DEFAULT 'received' NOT NULL,
	"kind" "inbound_kind" NOT NULL,
	"confirmation_code" text,
	"confirmation_url" text,
	"reject_reason" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_kind" "item_source_kind" NOT NULL,
	"newsletter_id" text,
	"inbound_message_id" text,
	"url" text,
	"title" text NOT NULL,
	"text" text,
	"text_hash" text,
	"limited" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"embedding" vector(768),
	"status" "item_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listening_events" (
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"episode_id" text NOT NULL,
	"chapter_id" text,
	"event" "listening_event" NOT NULL,
	"position_s" real,
	"client" "listening_client" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletters" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sender_email" text NOT NULL,
	"display_name" text NOT NULL,
	"list_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" "newsletter_priority" DEFAULT 'normal' NOT NULL,
	"last_issue_at" timestamp with time zone,
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
CREATE TABLE "usage_monthly" (
	"user_id" text NOT NULL,
	"month" date NOT NULL,
	"characters_used" integer DEFAULT 0 NOT NULL,
	"episodes_made" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_monthly_user_id_month_pk" PRIMARY KEY("user_id","month")
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
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"delivery_time" text DEFAULT '07:00' NOT NULL,
	"cadence" "cadence" DEFAULT 'weekly' NOT NULL,
	"weekly_day" integer DEFAULT 1 NOT NULL,
	"episode_minutes" integer DEFAULT 10 NOT NULL,
	"voice_id" text,
	"news_opt_in" boolean DEFAULT false NOT NULL,
	"news_mode" "news_mode" DEFAULT 'fill' NOT NULL,
	"news_country" text,
	"news_language" text,
	"feed_token" text NOT NULL,
	"inbound_alias" text NOT NULL,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_episode_minutes_check" CHECK ("users"."episode_minutes" in (5, 10, 20)),
	CONSTRAINT "users_weekly_day_check" CHECK ("users"."weekly_day" between 0 and 6),
	CONSTRAINT "users_delivery_time_check" CHECK ("users"."delivery_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "verified_senders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapter_sources" ADD CONSTRAINT "chapter_sources_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_sources" ADD CONSTRAINT "chapter_sources_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_items" ADD CONSTRAINT "heard_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_items" ADD CONSTRAINT "heard_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heard_items" ADD CONSTRAINT "heard_items_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_newsletter_id_newsletters_id_fk" FOREIGN KEY ("newsletter_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_inbound_message_id_inbound_messages_id_fk" FOREIGN KEY ("inbound_message_id") REFERENCES "public"."inbound_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_runs" ADD CONSTRAINT "step_runs_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_monthly" ADD CONSTRAINT "usage_monthly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topics" ADD CONSTRAINT "user_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_senders" ADD CONSTRAINT "verified_senders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_episode_position_key" ON "chapters" USING btree ("episode_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_user_date_key" ON "episodes" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "heard_items_user_cluster_idx" ON "heard_items" USING btree ("user_id","cluster_key");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_message_id_key" ON "inbound_messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "inbound_messages_user_received_idx" ON "inbound_messages" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "items_user_status_idx" ON "items" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "items_user_text_hash_idx" ON "items" USING btree ("user_id","text_hash");--> statement-breakpoint
CREATE INDEX "items_embedding_idx" ON "items" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "listening_events_user_time_idx" ON "listening_events" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletters_user_sender_key" ON "newsletters" USING btree ("user_id",lower("sender_email"));--> statement-breakpoint
CREATE UNIQUE INDEX "step_runs_episode_step_attempt_key" ON "step_runs" USING btree ("episode_id","step","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "user_topics_user_query_key" ON "user_topics" USING btree ("user_id",lower("query"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users" USING btree ("auth0_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_feed_token_key" ON "users" USING btree ("feed_token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_inbound_alias_key" ON "users" USING btree ("inbound_alias");--> statement-breakpoint
CREATE UNIQUE INDEX "verified_senders_user_email_key" ON "verified_senders" USING btree ("user_id",lower("email"));