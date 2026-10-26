ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "temp_password_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
-- Sign-in lookup also returns the temporary-password and suspension state, which the API enforces on every request.
DROP FUNCTION auth_lookup_user(text, text, boolean);
--> statement-breakpoint
CREATE FUNCTION auth_lookup_user(p_uid text, p_email text, p_email_verified boolean)
RETURNS TABLE (user_id uuid, user_role user_role, org_id uuid, email text, display_name text, otp_verified_auth_time bigint, totp_enabled boolean,
  must_change_password boolean, temp_password_expires_at timestamptz, suspended_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  RETURN QUERY SELECT u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
    EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL),
    u.must_change_password, u.temp_password_expires_at, u.suspended_at
    FROM users u WHERE u.firebase_uid = p_uid;
  IF FOUND THEN RETURN; END IF;
  IF p_email_verified AND p_email IS NOT NULL THEN
    RETURN QUERY UPDATE users u SET firebase_uid = p_uid, updated_at = now()
      WHERE lower(u.email) = lower(p_email) AND u.firebase_uid IS NULL
      RETURNING u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time,
        EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = u.id AND t.enabled_at IS NOT NULL),
        u.must_change_password, u.temp_password_expires_at, u.suspended_at;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_user(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text, boolean) TO proofpocket_app;
--> statement-breakpoint
-- Only an admin changes role, organisation, email or suspension; nobody can clear their own temporary-password
-- flag except through password_changed(). Founders and admins can never be suspended.
CREATE OR REPLACE FUNCTION users_protect_identity() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF current_user = 'proofpocket_app' AND app_role() <> 'admin' AND
     (NEW.role, NEW.org_id, NEW.is_lead, lower(NEW.email), NEW.suspended_at, NEW.suspended_reason)
       IS DISTINCT FROM (OLD.role, OLD.org_id, OLD.is_lead, lower(OLD.email), OLD.suspended_at, OLD.suspended_reason) THEN
    RAISE EXCEPTION 'only an admin can change a user''s role, organisation, email or suspension' USING ERRCODE = '42501';
  END IF;
  IF current_user = 'proofpocket_app' AND
     (NEW.must_change_password, NEW.temp_password_expires_at) IS DISTINCT FROM (OLD.must_change_password, OLD.temp_password_expires_at) THEN
    RAISE EXCEPTION 'the temporary-password state changes only through password_changed()' USING ERRCODE = '42501';
  END IF;
  IF NEW.suspended_at IS NOT NULL AND OLD.suspended_at IS NULL AND OLD.role IN ('founder', 'admin') THEN
    RAISE EXCEPTION 'founder and admin accounts can''t be suspended' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
-- After the API has set the person's own new password: the temporary one is gone, so clear the flag (own row only).
CREATE FUNCTION password_changed() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE users SET must_change_password = false, temp_password_expires_at = NULL, updated_at = now() WHERE id = app_user_id() $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION password_changed() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION password_changed() TO proofpocket_app;
--> statement-breakpoint
-- Founders see a summary of admins' account decisions: when, what, which role and organisation. No names, emails or
-- reasons (POPIA). Admins read the full audit log directly.
CREATE FUNCTION founder_admin_log(p_limit int) RETURNS TABLE (at timestamptz, action text, role text, organisation text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  IF app_role() NOT IN ('founder', 'admin') THEN RAISE EXCEPTION 'founders and admins only' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT a.at, a.action,
      COALESCE(CASE WHEN a.entity = 'portal_application' THEN (CASE p.kind::text WHEN 'funder' THEN 'funder' ELSE 'adviser' END) END, u.role::text),
      COALESCE(p.org_name, o.name)
    FROM audit_log a
    LEFT JOIN portal_applications p ON a.entity = 'portal_application' AND p.id::text = a.entity_id
    LEFT JOIN users u ON a.entity = 'user' AND u.id::text = a.entity_id
    LEFT JOIN organisations o ON o.id = u.org_id
    WHERE a.action IN ('portal_application.approved', 'portal_application.rejected', 'user.suspended', 'user.reinstated')
    ORDER BY a.id DESC LIMIT LEAST(GREATEST(p_limit, 1), 200);
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION founder_admin_log(int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION founder_admin_log(int) TO proofpocket_app;
