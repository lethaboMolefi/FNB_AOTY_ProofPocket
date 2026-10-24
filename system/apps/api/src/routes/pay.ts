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

  return r;
}
