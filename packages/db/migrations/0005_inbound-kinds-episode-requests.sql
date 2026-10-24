CREATE TYPE "public"."episode_request_reason" AS ENUM('scheduled', 'manual');--> statement-breakpoint
CREATE TYPE "public"."episode_request_status" AS ENUM('pending', 'running', 'done', 'skipped', 'failed');--> statement-breakpoint
ALTER TYPE "public"."inbound_kind" ADD VALUE 'sender_verification' BEFORE 'rejected';--> statement-breakpoint
CREATE TABLE "episode_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"reason" "episode_request_reason" NOT NULL,
	"status" "episode_request_status" DEFAULT 'pending' NOT NULL,
	"episode_id" text,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "episode_requests" ADD CONSTRAINT "episode_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_requests" ADD CONSTRAINT "episode_requests_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_requests_status_idx" ON "episode_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "episode_requests_scheduled_key" ON "episode_requests" USING btree ("user_id","date") WHERE "episode_requests"."reason" = 'scheduled';