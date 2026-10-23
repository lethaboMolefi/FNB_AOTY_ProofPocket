-- Row-level security: the second layer behind the API's own checks.
-- The API runs every request in a transaction and sets, with set_config(..., true) (= SET LOCAL):
--   app.user_id         the signed-in user's id ('' when signed out)
--   app.role            founder | funder | adviser | buyer | admin | public | joining
--   app.firebase_uid    only while a new founder joins (role 'joining')
--   app.pay_request_id  only on the public payment page (role 'public')
-- Migrations and the seed run as the table owner, which RLS does not restrict.
-- The API connects as proofpocket_app, which it does.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proofpocket_app') THEN
    CREATE ROLE proofpocket_app LOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO proofpocket_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO proofpocket_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO proofpocket_app;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM proofpocket_app;
--> statement-breakpoint

-- ---------------------------------------------------------------- context helpers
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('app.role', true), ''), 'anonymous') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_signed_in() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app_user_id() IS NOT NULL AND app_role() IN ('founder', 'funder', 'adviser', 'buyer', 'admin') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_pay_request_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT CASE WHEN app_role() = 'public' THEN nullif(current_setting('app.pay_request_id', true), '')::uuid END $$;
--> statement-breakpoint
-- SECURITY DEFINER: these read tables that have RLS themselves; running as the owner avoids recursion.
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT org_id FROM users WHERE id = app_user_id() $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_pay_company_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT company_id FROM payment_requests WHERE id = app_pay_request_id() $$;
--> statement-breakpoint
-- How the current user may see a company:
--   owner | admin | adviser (company is in their incubator) |
--   funder_full / funder_summary (Verified and sharing, or applied to this funder; the funder org must be verified)
CREATE OR REPLACE FUNCTION app_company_access(cid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT CASE
    WHEN app_role() = 'admin' AND app_user_id() IS NOT NULL THEN 'admin'
    WHEN app_role() = 'founder' AND c.owner_id = app_user_id() THEN 'owner'
    WHEN app_role() = 'adviser' AND c.incubator_id IS NOT NULL AND c.incubator_id = app_org_id() THEN 'adviser'
    WHEN app_role() = 'funder' AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = app_org_id() AND o.type = 'funder' AND o.verified) THEN
      CASE
        WHEN c.verified_at IS NOT NULL AND c.funder_sharing = 'full' THEN 'funder_full'
        WHEN c.verified_at IS NOT NULL AND c.funder_sharing = 'summary' THEN 'funder_summary'
        -- "Applying to a programme still shares your profile with that funder only." (inventory 12.20)
        WHEN EXISTS (SELECT 1 FROM applications a WHERE a.company_id = c.id AND a.funder_id = app_org_id()) THEN 'funder_summary'
      END
  END
  FROM companies c WHERE c.id = cid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_has(cid uuid, levels text[]) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(app_company_access(cid) = ANY(levels), false) $$;
--> statement-breakpoint
-- Users a person may look up: themselves, people in their organisation, a founder's incubator advisers,
-- an adviser's cohort founders. Admin sees everyone.
CREATE OR REPLACE FUNCTION app_user_visible(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT app_user_id() IS NOT NULL AND (
    uid = app_user_id()
    OR app_role() = 'admin'
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = uid AND u.org_id IS NOT NULL AND u.org_id = app_org_id())
    OR (app_role() = 'founder' AND EXISTS (
          SELECT 1 FROM companies c JOIN users u ON u.org_id = c.incubator_id
          WHERE c.owner_id = app_user_id() AND u.id = uid))
    OR (app_role() = 'adviser' AND EXISTS (
          SELECT 1 FROM companies c WHERE c.owner_id = uid AND c.incubator_id = app_org_id()))
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_org_id(), app_pay_company_id(), app_company_access(uuid), app_user_visible(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_org_id(), app_pay_company_id(), app_company_access(uuid), app_user_visible(uuid) TO proofpocket_app;
--> statement-breakpoint

-- ---------------------------------------------------------------- enable RLS on every table
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------- organisations, users
CREATE POLICY org_read ON organisations FOR SELECT USING (true);
--> statement-breakpoint
CREATE POLICY org_admin_write ON organisations FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY org_member_update ON organisations FOR UPDATE USING (app_signed_in() AND id = app_org_id()) WITH CHECK (id = app_org_id());
--> statement-breakpoint
CREATE POLICY users_read ON users FOR SELECT USING (app_user_visible(id));
--> statement-breakpoint
CREATE POLICY users_self_update ON users FOR UPDATE USING (id = app_user_id()) WITH CHECK (id = app_user_id());
--> statement-breakpoint
CREATE POLICY users_admin_write ON users FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY users_join_insert ON users FOR INSERT WITH CHECK (
  app_role() = 'joining' AND role = 'founder' AND firebase_uid = nullif(current_setting('app.firebase_uid', true), ''));
--> statement-breakpoint
CREATE POLICY users_join_read ON users FOR SELECT USING (
  app_role() = 'joining' AND firebase_uid = nullif(current_setting('app.firebase_uid', true), ''));
--> statement-breakpoint
CREATE POLICY otp_own ON otp_challenges FOR ALL USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint

-- ---------------------------------------------------------------- companies
CREATE POLICY companies_read ON companies FOR SELECT USING (app_company_access(id) IS NOT NULL OR app_role() = 'public');
--> statement-breakpoint
CREATE POLICY companies_insert ON companies FOR INSERT WITH CHECK (
  (app_role() = 'founder' AND owner_id = app_user_id()) OR app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY companies_update ON companies FOR UPDATE USING (app_has(id, '{owner,admin,adviser}')) WITH CHECK (app_has(id, '{owner,admin,adviser}'));
--> statement-breakpoint
CREATE POLICY companies_delete ON companies FOR DELETE USING (app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY memberships_read ON incubator_memberships FOR SELECT USING (
  app_has(company_id, '{owner,admin}') OR (app_role() = 'adviser' AND incubator_id = app_org_id()));
--> statement-breakpoint
CREATE POLICY memberships_insert ON incubator_memberships FOR INSERT WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY memberships_update ON incubator_memberships FOR UPDATE USING (
  app_has(company_id, '{owner,admin}') OR (app_role() = 'adviser' AND incubator_id = app_org_id()));
--> statement-breakpoint

-- ---------------------------------------------------------------- company-owned tables with simple rules
-- read_levels may read rows; write_levels may insert, update and delete.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('ledger_entries',        '{owner,admin,adviser,funder_full}', '{owner,admin}'),
    ('stock_items',           '{owner,admin,adviser,funder_full}', '{owner,admin}'),
    ('stock_movements',       '{owner,admin,adviser,funder_full}', '{owner,admin}'),
    ('suppliers',             '{owner,admin,adviser}',             '{owner,admin}'),
    ('supplier_bank_changes', '{owner,admin,adviser}',             '{owner,admin}'),
    ('statement_imports',     '{owner,admin,adviser}',             '{owner,admin}'),
    ('statement_lines',       '{owner,admin,adviser}',             '{owner,admin}'),
    ('monthly_history',       '{owner,admin,adviser,funder_full,funder_summary}', '{owner,admin}'),
    ('tender_interests',      '{owner,admin,adviser}',             '{owner,admin}'),
    ('intro_requests',        '{owner,admin,adviser}',             '{owner,admin}')
  ) AS v(tbl, read_levels, write_levels) LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (app_has(company_id, %L))', r.tbl || '_read', r.tbl, r.read_levels);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (app_has(company_id, %L)) WITH CHECK (app_has(company_id, %L))', r.tbl || '_write', r.tbl, r.write_levels, r.write_levels);
  END LOOP;
END $$;
--> statement-breakpoint
-- Advisers mark introductions and tender interest as arranged or declined.
CREATE POLICY tender_interests_handle ON tender_interests FOR UPDATE USING (app_has(company_id, '{adviser}'));
--> statement-breakpoint
CREATE POLICY intro_requests_handle ON intro_requests FOR UPDATE USING (app_has(company_id, '{adviser}'));
--> statement-breakpoint

-- ---------------------------------------------------------------- files and documents
CREATE POLICY files_read ON files FOR SELECT USING (app_has(company_id, '{owner,admin,adviser}'));
--> statement-breakpoint
CREATE POLICY files_write ON files FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY files_public_proof ON files FOR ALL
  USING (purpose = 'proof' AND company_id = app_pay_company_id())
  WITH CHECK (purpose = 'proof' AND company_id = app_pay_company_id());
--> statement-breakpoint
CREATE POLICY documents_read ON documents FOR SELECT USING (app_has(company_id, '{owner,admin,adviser,funder_full,funder_summary}'));
--> statement-breakpoint
CREATE POLICY documents_upload ON documents FOR INSERT WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY documents_review ON documents FOR UPDATE USING (app_has(company_id, '{admin,adviser}')) WITH CHECK (app_has(company_id, '{admin,adviser}'));
--> statement-breakpoint

-- ---------------------------------------------------------------- payments
CREATE POLICY payment_details_private ON payment_details FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY payment_details_pay_page ON payment_details FOR SELECT USING (company_id = app_pay_company_id());
--> statement-breakpoint
CREATE POLICY payment_requests_read ON payment_requests FOR SELECT USING (app_has(company_id, '{owner,admin,adviser}') OR id = app_pay_request_id());
--> statement-breakpoint
CREATE POLICY payment_requests_write ON payment_requests FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY payment_requests_pay_page ON payment_requests FOR UPDATE USING (id = app_pay_request_id()) WITH CHECK (id = app_pay_request_id());
--> statement-breakpoint
CREATE POLICY payment_proofs_read ON payment_proofs FOR SELECT USING (app_has(company_id, '{owner,admin,adviser}'));
--> statement-breakpoint
CREATE POLICY payment_proofs_write ON payment_proofs FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY payment_proofs_pay_page ON payment_proofs FOR INSERT WITH CHECK (payment_request_id = app_pay_request_id() AND company_id = app_pay_company_id());
--> statement-breakpoint

-- ---------------------------------------------------------------- messages, watch list, activity, audit
CREATE POLICY messages_read ON messages FOR SELECT USING (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
-- Funders (invites), advisers (send-backs), admin and the founder may add a message; only the founder and admin change it.
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (app_company_access(company_id) IS NOT NULL);
--> statement-breakpoint
CREATE POLICY messages_update ON messages FOR UPDATE USING (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY watchlist_read ON sender_watchlist FOR SELECT USING (app_signed_in());
--> statement-breakpoint
CREATE POLICY watchlist_report ON sender_watchlist FOR INSERT WITH CHECK (app_role() IN ('founder', 'admin'));
--> statement-breakpoint
CREATE POLICY watchlist_update ON sender_watchlist FOR UPDATE USING (app_role() IN ('founder', 'admin'));
--> statement-breakpoint
CREATE POLICY activity_read ON activity FOR SELECT USING (app_has(company_id, '{owner,admin,adviser,funder_full,funder_summary}'));
--> statement-breakpoint
CREATE POLICY activity_insert ON activity FOR INSERT WITH CHECK (app_company_access(company_id) IS NOT NULL OR company_id = app_pay_company_id());
--> statement-breakpoint
CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (app_role() <> 'anonymous');
--> statement-breakpoint
CREATE POLICY audit_read ON audit_log FOR SELECT USING (app_role() = 'admin');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();
--> statement-breakpoint

-- ---------------------------------------------------------------- profile and posts
CREATE POLICY profiles_read ON profiles FOR SELECT USING (app_company_access(company_id) IS NOT NULL OR app_role() = 'public');
--> statement-breakpoint
CREATE POLICY profiles_write ON profiles FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY posts_read ON posts FOR SELECT USING (app_company_access(company_id) IS NOT NULL OR (app_role() = 'public' AND feature = 'featured'));
--> statement-breakpoint
CREATE POLICY posts_write ON posts FOR ALL USING (app_has(company_id, '{owner,admin}')) WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint

-- ---------------------------------------------------------------- funding
CREATE POLICY programmes_read ON programmes FOR SELECT USING (app_signed_in());
--> statement-breakpoint
CREATE POLICY programmes_write ON programmes FOR ALL
  USING (app_role() = 'admin' OR (app_role() = 'funder' AND funder_id = app_org_id()))
  WITH CHECK (app_role() = 'admin' OR (app_role() = 'funder' AND funder_id = app_org_id()));
--> statement-breakpoint
CREATE POLICY programme_req_read ON programme_requirements FOR SELECT USING (app_signed_in());
--> statement-breakpoint
CREATE POLICY programme_req_write ON programme_requirements FOR ALL
  USING (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND (app_role() = 'admin' OR (app_role() = 'funder' AND p.funder_id = app_org_id()))))
  WITH CHECK (EXISTS (SELECT 1 FROM programmes p WHERE p.id = programme_id AND (app_role() = 'admin' OR (app_role() = 'funder' AND p.funder_id = app_org_id()))));
--> statement-breakpoint
CREATE POLICY applications_read ON applications FOR SELECT USING (
  app_has(company_id, '{owner,admin,adviser}') OR (app_role() = 'funder' AND funder_id = app_org_id()));
--> statement-breakpoint
CREATE POLICY applications_apply ON applications FOR INSERT WITH CHECK (app_has(company_id, '{owner,admin}'));
--> statement-breakpoint
CREATE POLICY applications_update ON applications FOR UPDATE USING (
  app_has(company_id, '{owner,admin}') OR (app_role() = 'funder' AND funder_id = app_org_id()));
--> statement-breakpoint
-- Offers follow their application's visibility (the subquery is itself filtered by applications_read).
CREATE POLICY offers_read ON offers FOR SELECT USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id));
--> statement-breakpoint
CREATE POLICY offers_insert ON offers FOR INSERT WITH CHECK (EXISTS (
  SELECT 1 FROM applications a WHERE a.id = application_id
  AND (app_has(a.company_id, '{owner,admin}') OR (app_role() = 'funder' AND a.funder_id = app_org_id()))));
--> statement-breakpoint
CREATE POLICY support_read ON support_logs FOR SELECT USING (app_has(company_id, '{owner,admin,adviser,funder_full,funder_summary}'));
--> statement-breakpoint
CREATE POLICY support_write ON support_logs FOR ALL USING (app_has(company_id, '{admin,adviser}')) WITH CHECK (app_has(company_id, '{admin,adviser}'));
--> statement-breakpoint

-- ---------------------------------------------------------------- tenders and reports
CREATE POLICY tenders_read ON tenders FOR SELECT USING (app_signed_in());
--> statement-breakpoint
CREATE POLICY tenders_admin ON tenders FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint
CREATE POLICY tender_req_read ON tender_requirements FOR SELECT USING (app_signed_in());
--> statement-breakpoint
CREATE POLICY tender_req_admin ON tender_requirements FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint
-- Anyone may report, including the public directory and payment page.
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (status = 'open');
--> statement-breakpoint
CREATE POLICY reports_admin ON reports FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');
--> statement-breakpoint

-- ---------------------------------------------------------------- sign-in lookup
-- Finds the user for a verified Firebase token, before any RLS context exists.
-- Invited and seeded users have no firebase_uid yet: the first sign-in with a verified email links them.
CREATE OR REPLACE FUNCTION auth_lookup_user(p_uid text, p_email text, p_email_verified boolean)
RETURNS TABLE (user_id uuid, user_role user_role, org_id uuid, email text, display_name text, otp_verified_auth_time bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
BEGIN
  RETURN QUERY SELECT u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time FROM users u WHERE u.firebase_uid = p_uid;
  IF FOUND THEN RETURN; END IF;
  IF p_email_verified AND p_email IS NOT NULL THEN
    RETURN QUERY UPDATE users u SET firebase_uid = p_uid, updated_at = now()
      WHERE lower(u.email) = lower(p_email) AND u.firebase_uid IS NULL
      RETURNING u.id, u.role, u.org_id, u.email, u.display_name, u.otp_verified_auth_time;
  END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION auth_lookup_user(text, text, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION auth_lookup_user(text, text, boolean) TO proofpocket_app;
--> statement-breakpoint

-- Users may edit their own row (display name, PIN state) but never their role, organisation, lead flag or email.
CREATE OR REPLACE FUNCTION users_protect_identity() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF current_user = 'proofpocket_app' AND app_role() <> 'admin' AND
     (NEW.role, NEW.org_id, NEW.is_lead, lower(NEW.email)) IS DISTINCT FROM (OLD.role, OLD.org_id, OLD.is_lead, lower(OLD.email)) THEN
    RAISE EXCEPTION 'only an admin can change a user''s role, organisation or email' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER users_protect_identity BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION users_protect_identity();
