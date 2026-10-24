// Incubator and NGO portal (phase 5). Document checks live in routes/checks.ts.
import { assignAdviserSchema, handledSchema, membershipDecisionSchema, stageMoveSchema, supportLogSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { assignAdviser, attention, cohort, decideMembership, handleRequest, incubatorOrg, logSupport, moveStage, supportView } from "../services/adviser";
import { companyDrawer } from "../services/company-view";

export function adviserRoutes(deps: Deps) {
  const r = Router();
  const adviser = requireUser(["adviser"]);
  const as = <T>(req: Request, fn: (tx: Tx, orgId: string | null) => Promise<T>) => withContext(deps.db, contextOf(req), (tx) => fn(tx, req.auth!.user!.orgId));
  const id = (req: Request) => String(req.params.id);

  r.get("/adviser/cohort", adviser, handle((req) => as(req, (tx, o) => cohort(tx, o))));
  r.get("/adviser/attention", adviser, handle((req) => as(req, (tx, o) => attention(tx, o))));
  r.get("/adviser/support", adviser, handle((req) => as(req, (tx, o) => supportView(tx, o))));
  r.post("/adviser/support", adviser, handle((req) => { const l = parse(supportLogSchema, req.body); return as(req, (tx, o) => logSupport(tx, actorOf(req), o, l)); }));
  r.get("/adviser/companies/:id", adviser, handle((req) => as(req, async (tx, o) => { await incubatorOrg(tx, o); return companyDrawer(tx, id(req), { role: "adviser", orgId: o }); })));
  r.post("/adviser/companies/:id/adviser", adviser, handle((req) => { const { adviserId } = parse(assignAdviserSchema, req.body); return as(req, (tx, o) => assignAdviser(tx, actorOf(req), o, id(req), adviserId)); }));
  r.post("/adviser/companies/:id/stage", adviser, handle((req) => { const { direction } = parse(stageMoveSchema, req.body); return as(req, (tx, o) => moveStage(tx, actorOf(req), o, id(req), direction)); }));
  r.post("/adviser/memberships/:id", adviser, handle((req) => { const { accept } = parse(membershipDecisionSchema, req.body); return as(req, (tx, o) => decideMembership(tx, actorOf(req), o, id(req), accept)); }));
  for (const kind of ["intro", "tender"] as const) {
    r.post(`/adviser/${kind}s/:id`, adviser, handle((req) => { const x = parse(handledSchema, req.body); return as(req, async (tx, o) => { await incubatorOrg(tx, o); return handleRequest(tx, actorOf(req), kind, id(req), x.status, x.note); }); }));
  }
  return r;
}
