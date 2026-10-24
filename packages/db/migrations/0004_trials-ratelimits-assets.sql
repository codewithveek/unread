CREATE TYPE "public"."trial_ended_reason" AS ENUM('episodes', 'expired', 'upgraded');--> statement-breakpoint
CREATE TABLE "audio_assets" (
	"key" text PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"duration_s" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_hits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "links" jsonb;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "topic_label" text;--> statement-breakpoint
ALTER TABLE "promo_codes" ADD COLUMN "trial_episode_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD COLUMN "episode_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD COLUMN "episodes_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD COLUMN "ended_reason" "trial_ended_reason";--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD COLUMN "reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "verified_senders" ADD COLUMN "verification_code" text;