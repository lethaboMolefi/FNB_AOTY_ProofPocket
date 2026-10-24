// Founder: Profile & marketing, Funding readiness, Procurement (phase 5).
import { applySchema, postSchema, profileSchema, sharedSchema } from "@proofpocket/shared";
import { Router, type Request } from "express";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany, type CompanyRow } from "../repositories/companies";
import { apply, askReason, createPost, expressInterest, fundingView, markShared, marketsView, procurementView, requestIntro, saveProfile, withdraw } from "../services/markets";

export function founderMarketRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);
  const asFounder = <T>(req: Request, fn: (tx: Tx, c: CompanyRow) => Promise<T>) =>
    withContext(deps.db, contextOf(req), async (tx) => fn(tx, await myCompany(tx, req.auth!.user!.id)));
  const id = (req: Request) => String(req.params.id);

  r.get("/founder/markets", founder, handle((req) => asFounder(req, (tx, c) => marketsView(tx, deps.config, c))));
  r.put("/founder/profile", founder, handle((req) => { const p = parse(profileSchema, req.body); return asFounder(req, (tx, c) => saveProfile(tx, actorOf(req), c, p)); }));
  r.post("/founder/posts", founder, handle((req) => { const p = parse(postSchema, req.body); return asFounder(req, (tx, c) => createPost(tx, actorOf(req), c, p)); }));
  r.post("/founder/posts/:id/shared", founder, handle((req) => { const { net } = parse(sharedSchema, req.body); return asFounder(req, (tx, c) => markShared(tx, c, id(req), net)); }));
  r.post("/founder/intros/:id", founder, handle((req) => asFounder(req, (tx, c) => requestIntro(tx, actorOf(req), c, id(req)))));

  r.get("/founder/funding", founder, handle((req) => asFounder(req, (tx, c) => fundingView(tx, c))));
  r.post("/founder/applications", founder, handle((req) => { const a = parse(applySchema, req.body); return asFounder(req, (tx, c) => apply(tx, actorOf(req), c, a.programmeId, a.amount)); }));
  r.post("/founder/applications/:id/ask-reason", founder, handle((req) => asFounder(req, (tx, c) => askReason(tx, actorOf(req), c, id(req)))));
  r.post("/founder/applications/:id/withdraw", founder, handle((req) => asFounder(req, (tx, c) => withdraw(tx, actorOf(req), c, id(req)))));

  r.get("/founder/procurement", founder, handle((req) => asFounder(req, (tx, c) => procurementView(tx, c))));
  r.post("/founder/tenders/:id/interest", founder, handle((req) => asFounder(req, (tx, c) => expressInterest(tx, actorOf(req), c, id(req)))));
  return r;
}
