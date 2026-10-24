CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."voice_provider" AS ENUM('kokoro', 'elevenlabs');--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"trial_days" integer NOT NULL,
	"max_redemptions" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_codes_trial_days_check" CHECK ("promo_codes"."trial_days" > 0),
	CONSTRAINT "promo_codes_redemptions_check" CHECK ("promo_codes"."max_redemptions" is null or "promo_codes"."redeemed_count" <= "promo_codes"."max_redemptions")
);
--> statement-breakpoint
CREATE TABLE "promo_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bachs_customer_id" text NOT NULL,
	"bachs_subscription_id" text NOT NULL,
	"product_id" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "voice_provider" "voice_provider";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kokoro_voice_id" text DEFAULT 'af_heart' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "elevenlabs_voice_id" text;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_code_id_promo_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "promo_redemptions_code_user_key" ON "promo_redemptions" USING btree ("code_id","user_id");--> statement-breakpoint
CREATE INDEX "promo_redemptions_user_trial_idx" ON "promo_redemptions" USING btree ("user_id","trial_ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_bachs_subscription_key" ON "subscriptions" USING btree ("bachs_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "voice_id";