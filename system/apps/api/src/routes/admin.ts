// Admin portal (phase 5). The checker queue lives in routes/checks.ts; authenticator resets in routes/auth.ts.
import { featureDecisionSchema, handledSchema, inviteUserSchema, organisationSchema, reportDecisionSchema, tenderSchema, watchDecisionSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { createLogin } from "../lib/identity";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { handleRequest } from "../services/adviser";
import {
  createOrganisation, createTender, decideFeature, decideReport, decideWatch, featureRequests, flaggedPayments, inviteUser, organisationsView, reportsView, setVerified, tendersView,
} from "../services/admin";

export function adminRoutes(deps: Deps) {
  const r = Router();
  const admin = requireUser(["admin"]);
  const as = <T>(req: Request, fn: (tx: Tx) => Promise<T>) => withContext(deps.db, contextOf(req), fn);
  const id = (req: Request) => String(req.params.id);

  r.get("/admin/organisations", admin, handle((req) => as(req, organisationsView)));
  r.post("/admin/organisations", admin, handle((req) => { const o = parse(organisationSchema, req.body); return as(req, (tx) => createOrganisation(tx, actorOf(req), o)); }));
  r.post("/admin/organisations/:id/verified", admin, handle((req) => { const { verified } = parse(z.object({ verified: z.boolean() }), req.body); return as(req, (tx) => setVerified(tx, actorOf(req), id(req), verified)); }));
  r.post("/admin/users", admin, handle(async (req) => {
    const u = parse(inviteUserSchema, req.body);
    const { orgName, role } = await as(req, (tx) => inviteUser(tx, actorOf(req), u));
    const how = await createLogin(deps.db, deps.config, u.email, u.displayName);
    await deps.mailer.send({ to: u.email, subject: `You're invited to ProofPocket (${orgName})`, text: `Hello ${u.displayName},\n\nYou've been added to ProofPocket as ${role === "adviser" ? "an adviser" : `a ${role}`} for ${orgName}.\n\n${how}\n\nSign in at ${deps.config.PUBLIC_WEB_URL}/sign-in. You'll set up Google Authenticator the first time.`, action: { label: "Sign in to ProofPocket", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } });
    return { message: `Invitation sent to ${u.email}` };
  }));

  r.get("/admin/reports", admin, handle((req) => as(req, async (tx) => ({ reports: await reportsView(tx) }))));
  r.post("/admin/reports/:id", admin, handle((req) => { const x = parse(reportDecisionSchema, req.body); return as(req, (tx) => decideReport(tx, actorOf(req), id(req), x.status, x.note)); }));
  r.get("/admin/features", admin, handle((req) => as(req, async (tx) => ({ posts: await featureRequests(tx) }))));
  r.post("/admin/features/:id", admin, handle((req) => { const x = parse(featureDecisionSchema, req.body); return as(req, (tx) => decideFeature(tx, actorOf(req), id(req), x.approve, x.note)); }));
  r.get("/admin/flagged", admin, handle((req) => as(req, flaggedPayments)));
  r.post("/admin/watchlist/:id", admin, handle((req) => { const { status } = parse(watchDecisionSchema, req.body); return as(req, (tx) => decideWatch(tx, actorOf(req), id(req), status)); }));
  r.get("/admin/tenders", admin, handle((req) => as(req, tendersView)));
  r.post("/admin/tenders", admin, handle((req) => { const t = parse(tenderSchema, req.body); return as(req, (tx) => createTender(tx, actorOf(req), t)); }));
  for (const kind of ["intro", "tender"] as const) {
    r.post(`/admin/${kind}s/:id`, admin, handle((req) => { const x = parse(handledSchema, req.body); return as(req, (tx) => handleRequest(tx, actorOf(req), kind, id(req), x.status, x.note)); }));
  }
  return r;
}
