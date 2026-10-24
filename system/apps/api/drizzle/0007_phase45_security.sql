-- Security fixes from the review (docs/security) and database support for phases 4-5.

-- ---------------------------------------------------------------- 1. The public context may see only its own payment request's company
-- (Finding: 'public' could read every company and profile.) The directory uses the functions below instead.
DROP POLICY companies_read ON companies;
--> statement-breakpoint
CREATE POLICY companies_read ON companies FOR SELECT USING (
  (app_role() = 'founder' AND owner_id = app_user_id())
  OR app_company_access(id) IS NOT NULL
  OR (app_role() = 'public' AND id = app_pay_company_id()));
--> statement-breakpoint
DROP POLICY profiles_read ON profiles;
--> statement-breakpoint
CREATE POLICY profiles_read ON profiles FOR SELECT USING (
  app_company_access(company_id) IS NOT NULL OR (app_role() = 'public' AND company_id = app_pay_company_id()));
--> statement-breakpoint
DROP POLICY posts_read ON posts;
--> statement-breakpoint
CREATE POLICY posts_read ON posts FOR SELECT USING (app_company_access(company_id) IS NOT NULL);
--> statement-breakpoint

-- ---------------------------------------------------------------- 2. Public directory and profiles: only public columns
CREATE FUNCTION public_directory() RETURNS TABLE (slug text, name text, sector text, town text, province text, tagline text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT c.slug, c.name, c.sector, c.town, c.province, coalesce(p.tagline, '')
  FROM companies c LEFT JOIN profiles p ON p.company_id = c.id
  WHERE c.verified_at IS NOT NULL AND c.joined_at IS NOT NULL
  ORDER BY c.name
$$;
--> statement-breakpoint
CREATE FUNCTION public_featured() RETURNS TABLE (slug text, name text, town text, text text, posted_on date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT c.slug, c.name, c.town, po.text, po.posted_on
  FROM posts po JOIN companies c ON c.id = po.company_id
  WHERE po.feature = 'featured' AND (po.featured_until IS NULL OR po.featured_until >= current_date) AND c.verified_at IS NOT NULL
  ORDER BY po.posted_on DESC
$$;
--> statement-breakpoint
-- Starters have a profile page too (inventory 12.11) but aren't listed; the badge shows which they are.
CREATE FUNCTION public_profile(p_slug text) RETURNS TABLE (
  company_id uuid, slug text, name text, sector text, town text, province text, founded_year smallint, verified boolean,
  tagline text, services text, whatsapp text, instagram text, hours text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT c.id, c.slug, c.name, c.sector, c.town, c.province, c.founded_year, c.verified_at IS NOT NULL,
    coalesce(p.tagline, ''), coalesce(p.services, ''), coalesce(p.whatsapp, ''), coalesce(p.instagram, ''), coalesce(p.hours, '')
  FROM companies c LEFT JOIN profiles p ON p.company_id = c.id
  WHERE c.slug = p_slug AND c.joined_at IS NOT NULL
$$;
--> statement-breakpoint
-- The payment page: PP reference + unguessable token → the request id, nothing else.
CREATE FUNCTION pay_lookup(p_ref text, p_token text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT id FROM payment_requests WHERE ref = p_ref AND public_token = p_token $$;
--> statement-breakpoint

-- ---------------------------------------------------------------- 3. Columns only certain roles may change
-- (Findings: an organisation member could set verified = true; a founder could set their own verified_at.)
CREATE OR REPLACE FUNCTION organisations_protect() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF current_user = 'proofpocket_app' AND app_role() <> 'admin' AND
     (NEW.verified, NEW.type, NEW.name, NEW.is_example) IS DISTINCT FROM (OLD.verified, OLD.type, OLD.name, OLD.is_example) THEN
    RAISE EXCEPTION 'only an admin can verify, rename or retype an organisation' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER organisations_protect BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION organisations_protect();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION companies_protect() RETURNS trigger LANGUAGE plpgsql AS
$$
DECLARE r text := app_role();
BEGIN
  IF current_user <> 'proofpocket_app' OR r = 'admin' THEN RETURN NEW; END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.is_example IS DISTINCT FROM OLD.is_example THEN
    RAISE EXCEPTION 'this field can''t be changed' USING ERRCODE = '42501';
  END IF;
  -- Verified comes only from document checks (advisers and the admin checker).
  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at AND r <> 'adviser' THEN
    RAISE EXCEPTION 'only a document check can verify a company' USING ERRCODE = '42501';
  END IF;
  IF (NEW.support_stage, NEW.adviser_id) IS DISTINCT FROM (OLD.support_stage, OLD.adviser_id) AND r <> 'adviser' THEN
    RAISE EXCEPTION 'only the incubator can change support stage or adviser' USING ERRCODE = '42501';
  END IF;
  -- The founder's own choices: sharing, money, consent, details.
  IF r = 'adviser' AND (NEW.funder_sharing, NEW.opening_balance, NEW.opening_balance_date, NEW.consent_at, NEW.joined_at, NEW.name, NEW.cipc_number)
       IS DISTINCT FROM (OLD.funder_sharing, OLD.opening_balance, OLD.opening_balance_date, OLD.consent_at, OLD.joined_at, OLD.name, OLD.cipc_number) THEN
    RAISE EXCEPTION 'only the founder can change this' USING ERRCODE = '42501';
  END IF;
  -- Founders choose an incubator while joining, and may leave one later; joining one afterwards needs the incubator to accept.
  IF r = 'founder' AND NEW.incubator_id IS DISTINCT FROM OLD.incubator_id AND OLD.joined_at IS NOT NULL AND NEW.incubator_id IS NOT NULL THEN
    RAISE EXCEPTION 'the incubator must accept you first' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER companies_protect BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION companies_protect();
--> statement-breakpoint
-- The public payment page may only move its request to "checking" (a proof was sent).
CREATE OR REPLACE FUNCTION payment_requests_protect() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF current_user = 'proofpocket_app' AND app_role() = 'public' THEN
    IF NOT (OLD.status IN ('waiting', 'not_received') AND NEW.status = 'checking')
       OR (NEW.amount, NEW.rails, NEW.company_id, NEW.ref, NEW.public_token, NEW.attempts, NEW.client_name, NEW.expires_at)
          IS DISTINCT FROM (OLD.amount, OLD.rails, OLD.company_id, OLD.ref, OLD.public_token, OLD.attempts, OLD.client_name, OLD.expires_at) THEN
      RAISE EXCEPTION 'the payment page can only send a proof of payment' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER payment_requests_protect BEFORE UPDATE ON payment_requests FOR EACH ROW EXECUTE FUNCTION payment_requests_protect();
--> statement-breakpoint

-- ---------------------------------------------------------------- 4. Offers: every change after the first needs a reason (repudiation)
CREATE OR REPLACE FUNCTION offers_need_reason() RETURNS trigger LANGUAGE plpgsql AS
$$
BEGIN
  IF NOT NEW.is_example AND length(trim(NEW.reason)) = 0
     AND EXISTS (SELECT 1 FROM offers o WHERE o.application_id = NEW.application_id) THEN
    RAISE EXCEPTION 'a changed offer needs a reason' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER offers_need_reason BEFORE INSERT ON offers FOR EACH ROW EXECUTE FUNCTION offers_need_reason();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION offers_append_only() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN RAISE EXCEPTION 'offer history is append-only'; END $$;
--> statement-breakpoint
CREATE TRIGGER offers_append_only BEFORE UPDATE OR DELETE ON offers FOR EACH ROW EXECUTE FUNCTION offers_append_only();
--> statement-breakpoint

-- ---------------------------------------------------------------- 5. Incubator membership requests (inventory 12.12)
CREATE FUNCTION incubator_requests() RETURNS TABLE (membership_id uuid, company_id uuid, name text, sector text, town text, requested_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT m.id, c.id, c.name, c.sector, c.town, m.created_at
  FROM incubator_memberships m JOIN companies c ON c.id = m.company_id
  WHERE app_role() = 'adviser' AND m.incubator_id = app_org_id() AND m.status = 'requested'
  ORDER BY m.created_at
$$;
--> statement-breakpoint
CREATE FUNCTION decide_membership(p_membership uuid, p_accept boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
DECLARE m incubator_memberships;
BEGIN
  SELECT * INTO m FROM incubator_memberships WHERE id = p_membership;
  IF NOT FOUND OR app_role() <> 'adviser' OR m.incubator_id IS DISTINCT FROM app_org_id() OR m.status <> 'requested' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_accept THEN
    UPDATE incubator_memberships SET status = 'left', decided_at = now() WHERE company_id = m.company_id AND status = 'active';
    UPDATE incubator_memberships SET status = 'active', decided_at = now() WHERE id = m.id;
    UPDATE companies SET incubator_id = m.incubator_id, adviser_id = NULL, support_stage = 0, updated_at = now() WHERE id = m.company_id;
  ELSE
    UPDATE incubator_memberships SET status = 'declined', decided_at = now() WHERE id = m.id;
  END IF;
  RETURN m.company_id;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public_directory(), public_featured(), public_profile(text), pay_lookup(text, text), incubator_requests(), decide_membership(uuid, boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public_directory(), public_featured(), public_profile(text), pay_lookup(text, text), incubator_requests(), decide_membership(uuid, boolean) TO proofpocket_app;
