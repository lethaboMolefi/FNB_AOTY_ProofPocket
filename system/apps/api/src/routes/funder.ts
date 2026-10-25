// Funder and investor portal (phase 5).
import { appStatusSchema, approveSchema, declineSchema, inviteSchema, offerSchema, programmeSchema, programmeStatusSchema, requirementToggleSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { companyDrawer } from "../services/company-view";
import {
  addProgramme, applicationsList, approve, changeOffer, decline, invite, pipeline, programmesView, requireSetup, setProgrammeStatus, setStatus, toggleRequirement,
} from "../services/funder";

export function funderRoutes(deps: Deps) {
  const r = Router();
  const funder = requireUser(["funder"]);
  const as = <T>(req: Request, fn: (tx: Tx, orgId: string) => Promise<T>) => withContext(deps.db, contextOf(req), (tx) => fn(tx, req.auth!.user!.orgId ?? ""));
  const id = (req: Request) => String(req.params.id);

  r.get("/funder/pipeline", funder, handle((req) => as(req, (tx, o) => pipeline(tx, o))));
  r.get("/funder/applications", funder, handle((req) => as(req, (tx, o) => applicationsList(tx, o))));
  r.get("/funder/programmes", funder, handle((req) => as(req, (tx, o) => programmesView(tx, o))));
  r.post("/funder/programmes", funder, handle((req) => { const p = parse(programmeSchema, req.body); return as(req, (tx, o) => addProgramme(tx, actorOf(req), o, p)); }));
  r.post("/funder/programmes/:id/requirements", funder, handle((req) => { const { docType } = parse(requirementToggleSchema, req.body); return as(req, (tx, o) => toggleRequirement(tx, actorOf(req), o, id(req), docType)); }));
  r.post("/funder/programmes/:id/status", funder, handle((req) => { const { status } = parse(programmeStatusSchema, req.body); return as(req, (tx, o) => setProgrammeStatus(tx, actorOf(req), o, id(req), status)); }));

  r.get("/funder/companies/:id", funder, handle((req) => as(req, async (tx, o) => { await requireSetup(tx, o); return companyDrawer(tx, id(req), { role: "funder", orgId: o }); })));
  r.post("/funder/companies/:id/invite", funder, handle((req) => { const { programmeId } = parse(inviteSchema, req.body); return as(req, (tx, o) => invite(tx, actorOf(req), o, id(req), programmeId)); }));
  r.post("/funder/applications/:id/offer", funder, handle((req) => { const x = parse(offerSchema, req.body); return as(req, (tx, o) => changeOffer(tx, actorOf(req), o, id(req), x.amount, x.reason)); }));
  r.post("/funder/applications/:id/approve", funder, handle((req) => { const x = parse(approveSchema, req.body ?? {}); return as(req, (tx, o) => approve(tx, actorOf(req), o, id(req), x.reason, x.confirmOverBudget)); }));
  r.post("/funder/applications/:id/decline", funder, handle((req) => { const x = parse(declineSchema, req.body); return as(req, (tx, o) => decline(tx, actorOf(req), o, id(req), x.reason)); }));
  r.post("/funder/applications/:id/status", funder, handle((req) => { const x = parse(appStatusSchema, req.body); return as(req, (tx, o) => setStatus(tx, actorOf(req), o, id(req), x.status, x.reason)); }));
  return r;
}
