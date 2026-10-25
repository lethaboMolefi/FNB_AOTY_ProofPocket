-- Phase 5: a count funders see on the pipeline ("N Starter or private") without seeing those companies.
CREATE FUNCTION joined_company_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT count(*)::int FROM companies WHERE joined_at IS NOT NULL AND app_signed_in() $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION joined_company_count() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION joined_company_count() TO proofpocket_app;
