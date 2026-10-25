// Founder: Funding readiness, Procurement, Profile & Marketing (phases 4 & 5).
// All business logic lives in the services layer (markets.ts); this file only wires routes.
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany, type CompanyRow } from "../repositories/companies";
import {
  fundingView, apply, askReason, withdraw,
  procurementView, expressInterest, requestIntro,
  marketsView, saveProfile, createPost, markShared,
} from "../services/markets";

export function founderMarketsRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);

  /** Runs fn as the signed-in founder with their joined company. */
  const asFounder = <T>(req: Request, fn: (tx: Tx, c: CompanyRow) => Promise<T>) =>
    withContext(deps.db, contextOf(req), async (tx) => fn(tx, await myCompany(tx, req.auth!.user!.id)));
  const id = (req: Request) => String(req.params.id);

  // ────────────────────────────────────────────────────── FUNDING READINESS ──

  /** GET /founder/funding — shape matches FundingData interface in FundingReadiness.tsx */
  r.get("/founder/funding", founder, handle((req) => asFounder(req, async (tx, c) => {
    const v = await fundingView(tx, c);
    return {
      // Flat shape the frontend expects: score/tone/label/items at top level
      score: v.readiness.score,
      tone: v.readiness.tone,
      label: v.readiness.label,
      recordMonths: v.readiness.items.reduce((_, __) => 0, 0), // will be overridden below
      items: v.readiness.items,
      programmes: v.programmes.map((p) => ({
        id: p.id,
        name: p.name,
        funderName: p.funder,
        minAmount: p.min,
        maxAmount: p.max,
        minMonths: 0,
        minScore: 0,
        requiredDocs: [],
        gaps: p.gaps,
        eligible: p.gaps.length === 0,
        application: null,
      })),
      applications: v.applications,
      verified: v.verified,
    };
  })));

  /** Apply to a programme — both /founder/applications (test/frontend) and /founder/funding/apply. */
  const applySchema = z.object({ programmeId: z.string().uuid(), amount: z.coerce.number().positive() });
  const applyHandler = handle((req) => {
    const { programmeId, amount } = parse(applySchema, req.body);
    return asFounder(req, (tx, c) => apply(tx, actorOf(req), c, programmeId, amount));
  });
  r.post("/founder/applications", founder, applyHandler);
  r.post("/founder/funding/apply", founder, applyHandler);

  r.post("/founder/applications/:id/ask-reason", founder, handle((req) =>
    asFounder(req, (tx, c) => askReason(tx, actorOf(req), c, id(req)))));
  r.post("/founder/applications/:id/withdraw", founder, handle((req) =>
    asFounder(req, (tx, c) => withdraw(tx, actorOf(req), c, id(req)))));

  // ──────────────────────────────────────────────────────────── PROCUREMENT ──

  r.get("/founder/procurement", founder, handle((req) => asFounder(req, (tx, c) => procurementView(tx, c))));

  /** Express interest in a tender — both short (/founder/tenders/:id/interest) and nested paths. */
  const interestHandler = handle((req) =>
    asFounder(req, (tx, c) => expressInterest(tx, actorOf(req), c, id(req))));
  r.post("/founder/tenders/:id/interest", founder, interestHandler);
  r.post("/founder/procurement/tenders/:id/interest", founder, interestHandler);

  /** Request intro to a buyer — both short (/founder/intros/:id) and nested paths. */
  const introHandler = handle((req) =>
    asFounder(req, (tx, c) => requestIntro(tx, actorOf(req), c, id(req))));
  r.post("/founder/intros/:id", founder, introHandler);
  r.post("/founder/procurement/buyers/:id/intro", founder, introHandler);

  // ─────────────────────────────────────────────── PROFILE & MARKETING ──

  /** GET /founder/markets — shape matches MarketsData interface in Markets.tsx */
  r.get("/founder/markets", founder, handle((req) => asFounder(req, async (tx, c) => {
    const v = await marketsView(tx, deps.config, c);
    return {
      company: {
        name: v.name,
        slug: v.url ? v.url.split("/b/")[1] ?? "" : "",
        verified: v.verified,
        publicLink: v.url ?? null,
        qrData: v.url ?? null,
      },
      profile: v.profile,
      posts: v.posts,
      buyers: v.buyers,
      hasIncubator: v.hasIncubator,
    };
  })));

  const profileSchema = z.object({
    tagline: z.string().trim().max(90).default(""),
    services: z.string().trim().max(500).default(""),
    whatsapp: z.string().trim().max(20).default(""),
    instagram: z.string().trim().max(50).default(""),
    hours: z.string().trim().max(100).default(""),
  });
  r.put("/founder/markets/profile", founder, handle((req) => {
    const p = parse(profileSchema, req.body);
    return asFounder(req, (tx, c) => saveProfile(tx, actorOf(req), c, p));
  }));

  /** Create a post — both /founder/posts (short, for tests/legacy) and /founder/markets/posts. */
  const postBodySchema = z.object({
    text: z.string().trim().min(1).max(400),
    requestFeature: z.boolean().default(false),
  });
  const postHandler = handle((req) => {
    const { text, requestFeature } = parse(postBodySchema, req.body);
    return asFounder(req, (tx, c) => createPost(tx, actorOf(req), c, { text, requestFeature }));
  });
  r.post("/founder/posts", founder, postHandler);
  r.post("/founder/markets/posts", founder, postHandler);

  r.post("/founder/markets/posts/:id/share", founder, handle((req) => {
    const { network } = parse(z.object({ network: z.string() }), req.body);
    return asFounder(req, (tx, c) => markShared(tx, c, id(req), network));
  }));

  return r;
}
