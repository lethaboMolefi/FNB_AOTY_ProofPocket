CREATE TABLE "user_totp" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_enc" text NOT NULL,
	"enabled_at" timestamp with time zone,
	"last_step" bigint DEFAULT 0 NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_totp" ADD CONSTRAINT "user_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE user_totp ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Only the person themselves can see or change their authenticator.
CREATE POLICY user_totp_self ON user_totp FOR ALL USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
-- Admin reset (lost phone) without being able to read anyone's secret.
CREATE FUNCTION admin_reset_totp(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  IF app_role() <> 'admin' OR app_user_id() IS NULL THEN RAISE EXCEPTION 'admin only' USING ERRCODE = '42501'; END IF;
  DELETE FROM user_totp WHERE user_id = p_user;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_reset_totp(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_reset_totp(uuid) TO proofpocket_app;
--> statement-breakpoint
DROP FUNCTION auth_lookup_user(text, text, boolean);
--> statement-breakpoint
CREATE FUNCTION auth_lookup_user(p_uid text, p_email text, p_email_verified boolean)
RETURNS TABLE (user_id uuid, user_role user_role, org_id uuid, email text, display_name text, otp_verified_auth_time bigint, totp_enabled boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  RETURN QUERY SELECT u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
    EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL)
    FROM users u WHERE u.firebase_uid = p_uid;
  IF FOUND THEN RETURN; END IF;
  IF p_email_verified AND p_email IS NOT NULL THEN
    RETURN QUERY UPDATE users u SET firebase_uid = p_uid, updated_at = now()
      WHERE lower(u.email) = lower(p_email) AND u.firebase_uid IS NULL
      RETURNING u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
        EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL);
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_user(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text, boolean) TO proofpocket_app;
