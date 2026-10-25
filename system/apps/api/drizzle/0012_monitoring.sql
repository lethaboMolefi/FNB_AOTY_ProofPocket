ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
-- Records when someone last used the API (for the admin's People page). Only this column, at most every 5 minutes.
CREATE FUNCTION touch_last_seen(uid uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ UPDATE users SET last_seen_at = now() WHERE id = uid AND (last_seen_at IS NULL OR last_seen_at < now() - interval '5 minutes') $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION touch_last_seen(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION touch_last_seen(uuid) TO proofpocket_app;
--> statement-breakpoint
-- Admin only: two-step status per user, without the secret (user_totp itself is readable only by its owner).
CREATE FUNCTION admin_two_factor_status() RETURNS TABLE (user_id uuid, enabled boolean, failed_attempts smallint, locked_until timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  IF app_role() <> 'admin' THEN RAISE EXCEPTION 'only an admin can see two-step status' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT t.user_id, t.enabled_at IS NOT NULL, t.failed_attempts, t.locked_until FROM user_totp t;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_two_factor_status() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_two_factor_status() TO proofpocket_app;
--> statement-breakpoint
-- Admin only: rate-limit pressure per limiter, without the keys (they contain IP addresses).
CREATE FUNCTION admin_rate_limit_summary() RETURNS TABLE (limiter text, clients bigint, hits bigint, busiest integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  IF app_role() <> 'admin' THEN RAISE EXCEPTION 'only an admin can see rate limits' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT split_part(r.key, ':', 1), count(*), coalesce(sum(r.hits), 0)::bigint, coalesce(max(r.hits), 0)
    FROM rate_limit_hits r WHERE r.reset_at > now() GROUP BY 1 ORDER BY 1;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION admin_rate_limit_summary() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION admin_rate_limit_summary() TO proofpocket_app;
