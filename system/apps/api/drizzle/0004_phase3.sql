-- Everything the shared readiness, flag and journey rules need about each company, in one call.
-- Returns only companies the caller can see (app_company_access). Funders at summary level get the
-- figures computed on the server, never the entries themselves: the API reduces this to scores and totals.
CREATE OR REPLACE FUNCTION company_rule_inputs(p_ids uuid[])
RETURNS TABLE (company_id uuid, inputs jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$
  SELECT c.id, jsonb_build_object(
    'openingBalance', c.opening_balance,
    'openingBalanceDate', c.opening_balance_date,
    'docs', coalesce((SELECT jsonb_agg(jsonb_build_object('docType', d.doc_type, 'version', d.version, 'status', d.status)) FROM documents d WHERE d.company_id = c.id), '[]'),
    'entries', coalesce((SELECT jsonb_agg(jsonb_build_object('date', e.entry_date, 'direction', e.direction, 'amount', e.amount, 'category', e.category, 'method', e.method, 'isPersonal', e.is_personal AND e.paid_back_at IS NULL))
                         FROM ledger_entries e WHERE e.company_id = c.id AND e.voided_at IS NULL), '[]'),
    'history', coalesce((SELECT jsonb_agg(jsonb_build_object('month', to_char(h.month, 'YYYY-MM'), 'moneyIn', h.money_in, 'moneyOut', h.money_out)) FROM monthly_history h WHERE h.company_id = c.id), '[]'),
    'stock', coalesce((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'reorderAt', s.reorder_at, 'cost', s.cost,
                         'qty', coalesce((SELECT sum(m.delta) FROM stock_movements m WHERE m.stock_item_id = s.id), 0)))
                       FROM stock_items s WHERE s.company_id = c.id AND s.archived_at IS NULL), '[]'),
    'paymentRequests', coalesce((SELECT jsonb_agg(jsonb_build_object('status', r.status)) FROM payment_requests r WHERE r.company_id = c.id), '[]'),
    'unverifiedOpenMessages', (SELECT count(*) FROM messages m WHERE m.company_id = c.id AND NOT m.verified_sender AND m.status = 'open'),
    'pendingSupplierChanges', (SELECT count(*) FROM suppliers s WHERE s.company_id = c.id AND s.pending_bank_masked IS NOT NULL AND s.archived_at IS NULL),
    'offerChangedWithoutReason', EXISTS (
      SELECT 1 FROM applications a WHERE a.company_id = c.id
        AND (SELECT count(*) FROM offers o WHERE o.application_id = a.id) > 1
        AND (SELECT o.reason FROM offers o WHERE o.application_id = a.id ORDER BY o.created_at DESC LIMIT 1) = '')
  )
  FROM companies c
  WHERE c.id = ANY(p_ids) AND app_company_access(c.id) IS NOT NULL
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION company_rule_inputs(uuid[]) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION company_rule_inputs(uuid[]) TO proofpocket_app;
