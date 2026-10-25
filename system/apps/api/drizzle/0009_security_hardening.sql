-- Security hardening (docs/security): tamper-evident audit log, shared rate limits and privacy requests.
ALTER TYPE "public"."report_target" ADD VALUE 'data_request';--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "chain_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "prev_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "consent_version" text;--> statement-breakpoint
CREATE INDEX "rate_limit_reset_idx" ON "rate_limit_hits" USING btree ("reset_at");--> statement-breakpoint

-- ---------------------------------------------------------------- audit log hash chain
-- Each row's hash covers its own fields and the previous row's hash, so editing, removing or reordering any row
-- (even with database owner rights) breaks the chain from that row on. The nightly export keeps the latest hash
-- outside the database, which also catches rows cut off the end.
-- quote_nullable keeps NULL and '' apart, and jsonb's text form is canonical.
CREATE FUNCTION audit_row_hash(prev text, seq bigint, a audit_log) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS
$$ SELECT encode(sha256(convert_to(concat_ws('|',
     prev, seq::text, ((extract(epoch FROM a.at) * 1000000)::bigint)::text,
     quote_nullable(a.actor_id), quote_nullable(a.actor_role), quote_nullable(a.action), quote_nullable(a.entity),
     quote_nullable(a.entity_id), quote_nullable(a.company_id), quote_nullable(a.before::text), quote_nullable(a.after::text),
     quote_nullable(a.request_id)), 'UTF8')), 'hex') $$;
--> statement-breakpoint
-- Number the existing rows (oldest first) and chain them. The append-only trigger is paused only for this.
ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_change;
--> statement-breakpoint
DO $$
DECLARE a audit_log; prev text := repeat('0', 64); seq bigint := 0; h text;
BEGIN
  FOR a IN SELECT * FROM audit_log ORDER BY id LOOP
    seq := seq + 1;
    h := audit_row_hash(prev, seq, a);
    UPDATE audit_log SET chain_seq = seq, prev_hash = prev, hash = h WHERE id = a.id;
    prev := h;
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_change;
--> statement-breakpoint
CREATE UNIQUE INDEX "audit_chain_seq_key" ON "audit_log" USING btree ("chain_seq");
--> statement-breakpoint
-- SECURITY DEFINER: the app role can't read audit_log, but each new row must see the last one.
-- The advisory lock makes writers extend the chain one at a time (held until the writer's transaction ends).
CREATE FUNCTION audit_log_chain() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS
$$
DECLARE last audit_log;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('proofpocket.audit_log_chain'));
  SELECT * INTO last FROM audit_log ORDER BY chain_seq DESC LIMIT 1;
  NEW.chain_seq := coalesce(last.chain_seq, 0) + 1;
  NEW.prev_hash := coalesce(last.hash, repeat('0', 64));
  NEW.hash := audit_row_hash(NEW.prev_hash, NEW.chain_seq, NEW);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_chain BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_chain();
--> statement-breakpoint
-- Walks the whole chain: rows checked, the first broken row (null when intact) and the latest hash.
-- Admins and the owner (scheduled jobs) may run it.
CREATE FUNCTION audit_log_verify() RETURNS TABLE (rows_checked bigint, first_broken_seq bigint, head_hash text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS
$$
DECLARE a audit_log; prev text := repeat('0', 64); expect bigint := 1;
BEGIN
  IF session_user = 'proofpocket_app' AND app_role() <> 'admin' THEN RAISE EXCEPTION 'only an admin can check the audit log'; END IF;
  rows_checked := 0;
  FOR a IN SELECT * FROM audit_log ORDER BY chain_seq LOOP
    rows_checked := rows_checked + 1;
    IF a.chain_seq <> expect OR a.prev_hash <> prev OR a.hash <> audit_row_hash(a.prev_hash, a.chain_seq, a) THEN
      first_broken_seq := a.chain_seq; head_hash := NULL; RETURN NEXT; RETURN;
    END IF;
    prev := a.hash; expect := expect + 1;
  END LOOP;
  first_broken_seq := NULL; head_hash := prev; RETURN NEXT;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION audit_log_verify() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION audit_log_verify() TO proofpocket_app;
--> statement-breakpoint

-- ---------------------------------------------------------------- shared rate limits
-- One counter per key (limiter name + client IP) per fixed window, shared by every API instance.
-- The table has RLS and no policies: the app role reaches it only through these functions.
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE FUNCTION rate_limit_hit(p_key text, p_window_ms integer, p_delta integer DEFAULT 1)
RETURNS TABLE (hits integer, reset_at timestamptz)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS
$$ INSERT INTO rate_limit_hits AS r (key, hits, reset_at)
   VALUES (p_key, greatest(p_delta, 0), clock_timestamp() + make_interval(secs => p_window_ms / 1000.0))
   ON CONFLICT (key) DO UPDATE SET
     hits = CASE WHEN r.reset_at <= clock_timestamp() THEN greatest(p_delta, 0) ELSE greatest(r.hits + p_delta, 0) END,
     reset_at = CASE WHEN r.reset_at <= clock_timestamp() THEN EXCLUDED.reset_at ELSE r.reset_at END
   RETURNING r.hits, r.reset_at $$;
--> statement-breakpoint
CREATE FUNCTION rate_limit_reset(p_key text) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS
$$ DELETE FROM rate_limit_hits WHERE key = p_key $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION rate_limit_hit(text, integer, integer), rate_limit_reset(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION rate_limit_hit(text, integer, integer), rate_limit_reset(text) TO proofpocket_app;
--> statement-breakpoint

-- ---------------------------------------------------------------- privacy requests
-- A founder may send a data request (correction or deletion) about their own company only.
-- target_type is compared as text: the new enum value can't be used in the transaction that adds it.
DROP POLICY reports_insert ON reports;
--> statement-breakpoint
CREATE POLICY reports_insert ON reports FOR INSERT WITH CHECK (
  status = 'open' AND (target_type::text <> 'data_request' OR (company_id IS NOT NULL AND app_company_access(company_id) = 'owner')));
