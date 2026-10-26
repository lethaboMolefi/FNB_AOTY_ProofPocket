CREATE TABLE "password_pending" (
	"firebase_uid" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON password_pending TO proofpocket_app;
--> statement-breakpoint
ALTER TABLE password_pending ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY password_pending_auth ON password_pending FOR ALL USING (app_role() = 'auth') WITH CHECK (app_role() = 'auth');
--> statement-breakpoint
-- needs_password: an email sign-up that finished joining (Join ProofPocket) but hasn't chosen its password yet.
DROP FUNCTION auth_lookup_user(text, text, boolean);
--> statement-breakpoint
CREATE FUNCTION auth_lookup_user(p_uid text, p_email text, p_email_verified boolean)
RETURNS TABLE (user_id uuid, user_role user_role, org_id uuid, email text, display_name text, otp_verified_auth_time bigint, totp_enabled boolean,
  must_change_password boolean, temp_password_expires_at timestamptz, suspended_at timestamptz, needs_password boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  RETURN QUERY SELECT u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
    EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL),
    u.must_change_password, u.temp_password_expires_at, u.suspended_at,
    EXISTS (SELECT 1 FROM password_pending p WHERE p.firebase_uid = u.firebase_uid)
      AND EXISTS (SELECT 1 FROM companies c WHERE c.owner_id = u.id AND c.joined_at IS NOT NULL)
    FROM users u WHERE u.firebase_uid = p_uid;
  IF FOUND THEN RETURN; END IF;
  IF p_email_verified AND p_email IS NOT NULL THEN
    RETURN QUERY UPDATE users u SET firebase_uid = p_uid, updated_at = now()
      WHERE lower(u.email) = lower(p_email) AND u.firebase_uid IS NULL
      RETURNING u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
        EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL),
        u.must_change_password, u.temp_password_expires_at, u.suspended_at, false;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_user(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text, boolean) TO proofpocket_app;
