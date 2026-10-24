ALTER TYPE "public"."otp_purpose" ADD VALUE 'two_factor';--> statement-breakpoint
CREATE TABLE "local_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "joined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "local_credentials_email_key" ON "local_credentials" USING btree (lower("email"));--> statement-breakpoint
-- New tables from now on are usable by the app role without a GRANT in every migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO proofpocket_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO proofpocket_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON local_credentials TO proofpocket_app;
--> statement-breakpoint
ALTER TABLE local_credentials ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Only the sign-in service (context role 'auth') touches password hashes.
CREATE POLICY local_credentials_auth ON local_credentials FOR ALL USING (app_role() = 'auth') WITH CHECK (app_role() = 'auth');
--> statement-breakpoint
DROP FUNCTION auth_lookup_user(text, text, boolean);
--> statement-breakpoint
CREATE FUNCTION auth_lookup_user(p_uid text, p_email text, p_email_verified boolean)
RETURNS TABLE (user_id uuid, user_role user_role, org_id uuid, email text, display_name text, otp_verified_auth_time bigint, two_factor_enabled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  RETURN QUERY SELECT u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time, u.two_factor_enabled FROM users u WHERE u.firebase_uid = p_uid;
  IF FOUND THEN RETURN; END IF;
  IF p_email_verified AND p_email IS NOT NULL THEN
    RETURN QUERY UPDATE users u SET firebase_uid = p_uid, updated_at = now()
      WHERE lower(u.email) = lower(p_email) AND u.firebase_uid IS NULL
      RETURNING u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time, u.two_factor_enabled;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_user(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text, boolean) TO proofpocket_app;
