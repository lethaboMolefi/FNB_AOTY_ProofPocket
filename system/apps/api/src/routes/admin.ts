// Admin portal (phase 5). The checker queue lives in routes/checks.ts; authenticator resets in routes/auth.ts.
import { OTP_ROLES, type Role, accountReasonSchema, applicationDecisionSchema, featureDecisionSchema, handledSchema, inviteUserSchema, organisationSchema, reportDecisionSchema, tenderSchema, watchDecisionSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { createLogin } from "../lib/identity";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { handleRequest } from "../services/adviser";
import { applicationsView, decideApplication } from "../services/applications";
import { approvalDetail, approvalsList, setSuspended } from "../services/approvals";
import { companyDrawer } from "../services/company-view";
import { activity, chain, companies, health, overview, people } from "../services/monitoring";
import { audit } from "../lib/audit";
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
    await deps.mailer.send({ to: u.email, subject: `You're invited to ProofPocket (${orgName})`, text: `Hello ${u.displayName},\n\nYou've been added to ProofPocket as ${role === "adviser" ? "an adviser" : `a ${role}`} for ${orgName}.\n\n${how}\n\nSign in at ${deps.config.PUBLIC_WEB_URL}/sign-in.${OTP_ROLES.includes(role as Role) ? " You'll set up Google Authenticator the first time." : ""}`, action: { label: "Sign in to ProofPocket", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } });
    return { message: `Invitation sent to ${u.email}` };
  }));

  // Monitoring: overview, activity (audit log), people and companies, security and health.
  const page = z.coerce.number().int().min(0).max(10_000).default(0);
  const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined));
  r.get("/admin/overview", admin, handle((req) => as(req, overview)));
  r.get("/admin/activity", admin, handle((req) => {
    const f = parse(z.object({ action: text(60), person: text(120), company: text(120), from: day, to: day, page }), req.query);
    return as(req, async (tx) => ({ ...(await activity(tx, f)), chain: f.page === 0 ? await chain(tx) : null }));
  }));
  r.get("/admin/people", admin, handle((req) => {
    const f = parse(z.object({ q: text(120), role: z.enum(["founder", "funder", "adviser", "buyer", "admin"]).optional().or(z.literal("").transform(() => undefined)), page }), req.query);
    return as(req, (tx) => people(tx, f));
  }));
  r.get("/admin/companies", admin, handle((req) => {
    const f = parse(z.object({ q: text(120), status: z.enum(["starter", "verified", "unfinished"]).optional().or(z.literal("").transform(() => undefined)), page }), req.query);
    return as(req, (tx) => companies(tx, f));
  }));
  r.get("/admin/companies/:id", admin, handle((req) => {
    const companyId = parse(z.string().uuid(), req.params.id);
    // Opening one founder's books is recorded (POPIA: the admin sees totals everywhere else).
    return as(req, async (tx) => {
      const d = await companyDrawer(tx, companyId, { role: "admin", orgId: null });
      await audit(tx, actorOf(req), { action: "admin.company_viewed", entity: "company", entityId: companyId, companyId });
      return d;
    });
  }));
  r.get("/admin/health", admin, handle((req) => as(req, (tx) => health(tx, process.env.APP_VERSION))));

  // Portal applications from funders and support organisations.
  r.get("/admin/applications", admin, handle((req) => as(req, (tx) => applicationsView(tx, deps.config))));
  /** Decide a portal application and email the applicant (approved: how to sign in; turned down: the reason). */
  const decide = async (req: Request) => {
    const d = parse(applicationDecisionSchema, req.body);
    const res = await as(req, (tx) => decideApplication(tx, actorOf(req), id(req), d));
    const portal = res.kind === "funder" ? "funder portal" : "support organisation portal";
    await deps.mailer.send(res.approved
      ? { to: res.email, subject: "Your ProofPocket application was approved", text: `${res.orgName} now has a ProofPocket ${portal}.\n\nSign in with the email address and password you applied with. The first time, you'll set up Google Authenticator so nobody can use a stolen password to get in.`, action: { label: "Sign in to ProofPocket", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } }
      : { to: res.email, subject: "Your ProofPocket application", text: `We couldn't approve the ${portal} for ${res.orgName}.\n\nThe reason: ${res.reason}\n\nIf something can be fixed, reply to this email and we'll look at it again.` });
    return { message: res.message };
  };
  r.post("/admin/applications/:id", admin, handle(decide));

  // User approvals: everyone who isn't a founder. Founders, other admins and yourself are refused (403).
  const approvalFilters = z.object({
    q: z.string().trim().max(120).optional(),
    role: z.enum(["funder", "adviser", "buyer", "admin"]).optional().or(z.literal("").transform(() => undefined)),
    status: z.enum(["pending", "approved", "rejected", "suspended"]).optional().or(z.literal("").transform(() => undefined)),
  });
  r.get("/admin/approvals", admin, handle((req) => { const f = parse(approvalFilters, req.query); return as(req, (tx) => approvalsList(tx, { id: req.auth!.user!.id }, f)); }));
  r.get("/admin/approvals/:type/:id", admin, handle((req) => {
    const type = parse(z.enum(["application", "user"]), req.params.type);
    return as(req, (tx) => approvalDetail(tx, deps.config, { id: req.auth!.user!.id }, type, parse(z.string().uuid(), req.params.id)));
  }));
  r.post("/admin/approvals/application/:id", admin, handle(decide));
  r.post("/admin/approvals/user/:id/suspend", admin, handle(async (req) => {
    const { reason } = parse(accountReasonSchema, req.body);
    const res = await as(req, (tx) => setSuspended(tx, actorOf(req), parse(z.string().uuid(), req.params.id), { reason }));
    await deps.mailer.send({ to: res.email, subject: "Your ProofPocket account is suspended", text: `Your ProofPocket account has been suspended.\n\nThe reason: ${reason}\n\nIf you think this is a mistake, reply to this email.` });
    return { message: res.message };
  }));
  r.post("/admin/approvals/user/:id/reinstate", admin, handle(async (req) => {
    const res = await as(req, (tx) => setSuspended(tx, actorOf(req), parse(z.string().uuid(), req.params.id), null));
    await deps.mailer.send({ to: res.email, subject: "Your ProofPocket account is active again", text: "You can sign in to ProofPocket again.", action: { label: "Sign in to ProofPocket", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } });
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
