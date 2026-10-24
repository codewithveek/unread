DROP INDEX "episodes_user_date_key";--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "audio_bytes" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "current_step" "pipeline_step";--> statement-breakpoint
CREATE INDEX "episodes_user_date_idx" ON "episodes" USING btree ("user_id","date");