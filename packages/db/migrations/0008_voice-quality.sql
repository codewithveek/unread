CREATE TYPE "public"."voice_quality" AS ENUM('flash', 'studio');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voice_quality" "voice_quality" DEFAULT 'flash' NOT NULL;