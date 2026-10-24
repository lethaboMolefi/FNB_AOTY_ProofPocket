// Document checks: advisers for their cohort, the admin checker for companies without an incubator.
import { reviewApproveSchema, reviewRejectSchema } from "@proofpocket/shared";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { ownerOf } from "../repositories/companies";
import { reviewDocument, reviewQueue, type ReviewResult } from "../services/documents";

export function checkRoutes(deps: Deps) {
  const r = Router();

  async function notify(companyId: string, res: ReviewResult, req: Parameters<typeof contextOf>[0]) {
    const owner = await withContext(deps.db, contextOf(req), (tx) => ownerOf(tx, companyId));
    if (!owner) return;
    if (res.verifiedNow) await deps.mailer.send({ to: owner.email, subject: "You're verified on ProofPocket", text: `${res.companyName} is now Verified. Funders, buyers and customers can find you in the ProofPocket directory.\n\n${deps.config.PUBLIC_WEB_URL}` });
    else if (res.rejected) await deps.mailer.send({ to: owner.email, subject: `Please upload your ${res.docName} again`, text: `Your ${res.docName} was sent back: ${res.reason}\n\nUpload a new one under Registration steps: ${deps.config.PUBLIC_WEB_URL}/app/start` });
  }

  for (const scope of ["adviser", "admin"] as const) {
    const guard = requireUser([scope]);
    r.get(`/${scope}/checks`, guard, handle(async (req) => ({ queue: await withContext(deps.db, contextOf(req), (tx) => reviewQueue(tx, scope)) })));
    r.post(`/${scope}/checks/:id/approve`, guard, handle(async (req) => {
      const { expiresOn } = parse(reviewApproveSchema, req.body ?? {});
      const u = req.auth!.user!;
      const res = await withContext(deps.db, contextOf(req), (tx) => reviewDocument(tx, { ...actorOf(req), displayName: u.displayName, orgId: u.orgId }, String(req.params.id), scope, { approve: true, expiresOn }));
      await notify(res.companyId, res, req);
      return { ...res, message: res.verifiedNow ? `${res.companyName} is now Verified` : "Approved" };
    }));
    r.post(`/${scope}/checks/:id/reject`, guard, handle(async (req) => {
      const { reason } = parse(reviewRejectSchema, req.body);
      const u = req.auth!.user!;
      const res = await withContext(deps.db, contextOf(req), (tx) => reviewDocument(tx, { ...actorOf(req), displayName: u.displayName, orgId: u.orgId }, String(req.params.id), scope, { approve: false, reason }));
      await notify(res.companyId, res, req);
      return { ...res, message: "Sent back to the founder" };
    }));
  }
  return r;
}
