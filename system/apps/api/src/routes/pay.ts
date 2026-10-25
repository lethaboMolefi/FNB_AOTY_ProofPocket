// The public payment page (no account). The link's unguessable token is sent in the X-Pay-Token header,
// so it never appears in request logs.
import { proofSchema, reportSchema, uploadStartSchema } from "@proofpocket/shared";
import { sql } from "drizzle-orm";
import { Router, type Request } from "express";
import type { Deps } from "../app";
import { withContext, type DbContext } from "../db/client";
import { reports } from "../db/schema/index";
import { notFound } from "../lib/errors";
import { handle, limits, parse } from "../middleware/http";
import { completeUpload, startUpload } from "../services/files";
import { payPageView, submitProof } from "../services/payments";
import { buildPayfastForm, payfastEnabled, validateItn, processItn, type ItnPayload } from "../services/payfast";

export function payRoutes(deps: Deps) {
  const r = Router();

  /** Reference + token → a context that can see only this request. Same answer for a wrong ref or a wrong token. */
  async function payContext(req: Request): Promise<DbContext & { payRequestId: string }> {
    const ref = String(req.params.ref);
    const token = String(req.header("x-pay-token") ?? "");
    if (!/^PP-\d{4,6}$/.test(ref) || !/^[A-Za-z0-9_-]{8,64}$/.test(token)) throw notFound("This payment request");
    const id = await withContext(deps.db, { role: "public" }, async (tx) =>
      (await tx.execute<{ id: string | null }>(sql`select pay_lookup(${ref}, ${token}) as id`)).rows[0]?.id ?? null);
    if (!id) throw notFound("This payment request");
    return { role: "public", payRequestId: id };
  }

  r.get("/pay/:ref", limits.pay(), handle(async (req) => {
    const ctx = await payContext(req);
    return withContext(deps.db, ctx, (tx) => payPageView(tx, deps.config, ctx.payRequestId));
  }));

  r.post("/pay/:ref/uploads", limits.uploads(), handle(async (req) => {
    const ctx = await payContext(req);
    const u = parse(uploadStartSchema, { ...req.body, purpose: "receipt" });
    return withContext(deps.db, ctx, async (tx) => {
      const companyId = (await tx.execute<{ id: string }>(sql`select app_pay_company_id() as id`)).rows[0]!.id;
      return startUpload(tx, deps.store, { ...u, purpose: "proof", companyId, userId: null });
    });
  }));
  r.post("/pay/:ref/uploads/:id/complete", limits.uploads(), handle(async (req) => {
    const ctx = await payContext(req);
    return withContext(deps.db, ctx, (tx) => completeUpload(tx, deps.store, String(req.params.id)));
  }));

  r.post("/pay/:ref/proof", limits.pay(), handle(async (req) => {
    const ctx = await payContext(req);
    const p = parse(proofSchema, req.body);
    const res = await withContext(deps.db, ctx, (tx) => submitProof(tx, ctx.payRequestId, p));
    return { message: res.message };
  }));

  r.post("/pay/:ref/report", limits.pay(), handle(async (req) => {
    const ctx = await payContext(req);
    const { reason } = parse(reportSchema, req.body ?? {});
    await withContext(deps.db, ctx, async (tx) => {
      const companyId = (await tx.execute<{ id: string }>(sql`select app_pay_company_id() as id`)).rows[0]!.id;
      await tx.insert(reports).values({ targetType: "payment_request", targetId: ctx.payRequestId, companyId, reason });
    });
    return { message: "Thanks. ProofPocket will review this business within two working days." };
  }));

  // ------------------------------------------------------------ PayFast gateway
  /**
   * Returns the PayFast form fields the browser should POST to PayFast's /eng/process.
   * Called from the public pay page when the user clicks "Pay by card".
   */
  r.post("/pay/:ref/payfast/initiate", limits.pay(), handle(async (req) => {
    if (!payfastEnabled(deps.config)) throw notFound("PayFast is not enabled");
    const ctx = await payContext(req);
    const view = await withContext(deps.db, ctx, (tx) => payPageView(tx, deps.config, ctx.payRequestId));

    // Build notify_url — the ITN webhook. Must be publicly reachable.
    const apiBase = deps.config.PUBLIC_WEB_URL.replace(/\/$/, "").replace(
      /^http:\/\/localhost:\d+/,
      // In local dev the API is on :8787; sub-domain tunnelling would be needed for real ITN.
      // For the hackathon demo/sandbox this is fine — sandbox PayFast still calls notify_url.
      `http://localhost:${deps.config.PORT}`,
    );
    const notifyUrl = `${apiBase}/api/v1/payfast/itn`;
    const returnUrl = `${deps.config.PUBLIC_WEB_URL}/pay/${req.params.ref}?payfast=success`;
    const cancelUrl = `${deps.config.PUBLIC_WEB_URL}/pay/${req.params.ref}?payfast=cancelled`;

    const result = buildPayfastForm(deps.config, {
      requestId: ctx.payRequestId,
      ref: view.ref,
      amount: view.amount,
      description: view.what || `Payment to ${view.business.name}`,
      buyerName: view.client,
      notifyUrl,
      returnUrl,
      cancelUrl,
    });

    return result; // { host, fields }
  }));

  /**
   * PayFast Instant Transaction Notification (ITN) webhook.
   * PayFast POSTs here when a payment completes. We verify the signature, validate
   * with PayFast server-side, then auto-book the entry.
   *
   * This endpoint is unauthenticated (no session token) — the PayFast signature IS
   * the authentication. It must respond with HTTP 200 immediately.
   */
  r.post("/payfast/itn", handle(async (req, res) => {
    // Capture the raw body for server-side validation (the middleware already parsed JSON;
    // for ITN we need the raw form body — express.json doesn't affect urlencoded).
    const payload = req.body as ItnPayload;
    // Re-encode the received fields as a query string for the validation call.
    const rawBody = Object.keys(payload)
      .filter((k) => k !== "signature")
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(payload[k] ?? "")}`)
      .join("&");

    try {
      const grossAmount = await validateItn(deps.config, payload, rawBody);
      // The ITN is a server-to-server call from PayFast — no user session.
      // Use "anonymous" role so RLS is satisfied; the service itself queries directly.
      const actor: import("../lib/audit").Actor = { userId: null, role: "payfast_itn" };
      await withContext(deps.db, { role: "anonymous" }, (tx) =>
        processItn(tx, deps.config, actor, payload, grossAmount));
    } catch (e: unknown) {
      // If it's a 200-class "not complete" (e.g. FAILED), log and move on.
      const err = e as { code?: string; statusCode?: number };
      if (err?.code === "itn_not_complete" || err?.statusCode === 200) {
        deps.log.info({ itn: payload.payment_status }, "PayFast ITN not COMPLETE — ignoring");
      } else {
        deps.log.warn({ err, itn: payload }, "PayFast ITN processing error");
      }
    }
    // PayFast requires a 200 response regardless of our internal result.
    res.status(200).send("OK");
    return undefined;
  }));

  return r;
}
