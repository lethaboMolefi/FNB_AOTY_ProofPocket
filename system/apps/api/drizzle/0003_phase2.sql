-- INSERT ... RETURNING must pass the read policy too, and app_company_access() can't see a row inserted
-- by the same statement. A founder reads their own company by owner_id directly.
DROP POLICY companies_read ON companies;
--> statement-breakpoint
CREATE POLICY companies_read ON companies FOR SELECT USING (
  (app_role() = 'founder' AND owner_id = app_user_id()) OR app_company_access(id) IS NOT NULL OR app_role() = 'public');
--> statement-breakpoint
-- "This exact file was used as proof before": checked across every business, but only returns true/false.
CREATE OR REPLACE FUNCTION file_sha_seen(p_sha text, p_except uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM files WHERE sha256 = p_sha AND id <> p_except) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION file_sha_seen(text, uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION file_sha_seen(text, uuid) TO proofpocket_app;
