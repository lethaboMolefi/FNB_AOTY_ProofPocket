DROP TABLE "otp_challenges" CASCADE;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "two_factor_enabled";--> statement-breakpoint
DROP TYPE "public"."otp_purpose";