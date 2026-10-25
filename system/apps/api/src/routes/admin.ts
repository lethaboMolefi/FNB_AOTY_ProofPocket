// Admin portal (phase 5). The checker queue lives in routes/checks.ts; authenticator resets in routes/auth.ts.
import { applicationDecisionSchema, featureDecisionSchema, handledSchema, inviteUserSchema, organisationSchema, reportDecisionSchema, tenderSchema, watchDecisionSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { createLogin } from "../lib/identity";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { handleRequest } from "../services/adviser";
import { applicationsView, decideApplication } from "../services/applications";
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

  // Portal applications from funders and support organisations.
  r.get("/admin/applications", admin, handle((req) => as(req, (tx) => applicationsView(tx, deps.config))));
  r.post("/admin/applications/:id", admin, handle(async (req) => {
    const d = parse(applicationDecisionSchema, req.body);
    const res = await as(req, (tx) => decideApplication(tx, actorOf(req), id(req), d));
    const portal = res.kind === "funder" ? "funder portal" : "support organisation portal";
    await deps.mailer.send(res.approved
      ? { to: res.email, subject: "Your ProofPocket application was approved", text: `${res.orgName} now has a ProofPocket ${portal}.\n\nSign in with the email address and password you applied with. The first time, you'll set up Google Authenticator so nobody can use a stolen password to get in.`, action: { label: "Sign in to ProofPocket", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } }
      : { to: res.email, subject: "Your ProofPocket application", text: `We couldn't approve the ${portal} for ${res.orgName}.\n\nThe reason: ${res.reason}\n\nIf something can be fixed, reply to this email and we'll look at it again.` });
    return { message: res.message };
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
