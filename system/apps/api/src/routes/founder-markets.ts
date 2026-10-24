// Founder: Payments, Fraud protection, Privacy, Funding readiness, Procurement, Profile & Marketing (phases 4 & 5).
import {
  DOCS, DOC_TYPES, RAIL_KEYS, RAILS, R, canApply, programmeGaps, readiness,
  scoreTone, scoreLabel, recordMonths, tenderAction, todayZA,
  type DocType, type FunderSharing, type Rail,
} from "@proofpocket/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import {
  applications, companies, introRequests, messages, offers, organisations,
  paymentDetails, paymentProofs, paymentRequests, posts, profiles,
  programmeRequirements, programmes, senderWatchlist,
  tenderInterests, tenderRequirements, tenders,
} from "../db/schema/index";
import { addActivity } from "../lib/audit";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany, type CompanyRow } from "../repositories/companies";
import { loadSnapshot } from "../services/snapshot";
import { documentsOf } from "../services/documents";
import { badRequest } from "../lib/errors";

export function founderMarketsRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);

  /** Runs fn as the signed-in founder with their joined company. */
  const asFounder = <T>(req: Request, fn: (tx: Tx, c: CompanyRow) => Promise<T>) =>
    withContext(deps.db, contextOf(req), async (tx) => fn(tx, await myCompany(tx, req.auth!.user!.id)));

  // ─────────────────────────────────────────────────────────────── PAYMENTS ──

  r.get("/founder/payments", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const reqs = await tx.select().from(paymentRequests)
      .where(eq(paymentRequests.companyId, c.id))
      .orderBy(desc(paymentRequests.createdAt))
      .limit(50);
    const details = await tx.select().from(paymentDetails)
      .where(eq(paymentDetails.companyId, c.id))
      .orderBy(desc(paymentDetails.createdAt))
      .limit(1);
    const proofs = reqs.length
      ? await tx.select().from(paymentProofs)
          .where(inArray(paymentProofs.paymentRequestId, reqs.map((r) => r.id)))
      : [];
    const proofByReq = new Map(proofs.map((p) => [p.paymentRequestId, p]));
    return {
      paymentDetails: details[0] ? {
        bank: details[0].bank,
        accountName: details[0].accountName,
        accountLast4: details[0].accountLast4,
        shapId: details[0].shapId,
        inBusinessName: details[0].inBusinessName,
      } : null,
      requests: reqs.map((req) => {
        const proof = proofByReq.get(req.id);
        return {
          id: req.id,
          ref: req.ref,
          clientName: req.clientName,
          amount: Number(req.amount),
          description: req.description,
          rails: req.rails as Rail[],
          status: req.status,
          requestedOn: req.requestedOn,
          expiresAt: req.expiresAt?.toISOString() ?? null,
          publicLink: `${deps.config.WEB_ORIGIN}/pay/${req.ref}-${req.publicToken}`,
          proof: proof ? {
            payerName: proof.payerName,
            amount: Number(proof.amount),
            paidOn: proof.paidOn,
            method: proof.method as Rail,
            usedReference: proof.usedReference,
            checks: proof.checkResults as { code: string; ok: boolean; text: string }[],
            status: proof.status,
          } : null,
        };
      }),
    };
  })));

  /** Create a payment request (generates ref + public token + pay link). */
  const createRequestSchema = z.object({
    clientName: z.string().trim().min(1).max(100),
    amount: z.coerce.number().positive(),
    description: z.string().trim().max(200).default(""),
    rails: z.array(z.enum(RAIL_KEYS as [Rail, ...Rail[]])).min(1),
  });

  r.post("/founder/payments", founder, handle((req) => asFounder(req, async (tx, c) => {
    const body = parse(createRequestSchema, req.body);
    const today = todayZA();
    // Generate a 4–6 digit sequential ref (PP-XXXX).
    const last = await tx.select({ ref: paymentRequests.ref })
      .from(paymentRequests)
      .where(eq(paymentRequests.companyId, c.id))
      .orderBy(desc(paymentRequests.createdAt))
      .limit(1);
    const lastNum = last[0] ? Number(last[0].ref.replace("PP-", "")) : 4820;
    const nextNum = lastNum + 1;
    const ref = `PP-${nextNum}`;
    const publicToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await tx.insert(paymentRequests).values({
      companyId: c.id,
      ref,
      publicToken,
      clientName: body.clientName,
      amount: String(body.amount),
      description: body.description,
      rails: body.rails,
      requestedOn: today,
      expiresAt,
      createdBy: req.auth!.user!.id,
    });
    await addActivity(tx, c.id, `Payment request ${ref} created for ${R(body.amount)} from ${body.clientName}.`, req.auth!.user!.id);
    return { ok: true, ref, publicLink: `${deps.config.WEB_ORIGIN}/pay/${ref}-${publicToken}`, message: `Payment request ${ref} created.` };
  })));

  /** Founder confirms they received the money (or rejects the proof). */
  r.post("/founder/payments/:id/received", founder, handle((req) => asFounder(req, async (tx, c) => {
    const pr = await tx.select().from(paymentRequests)
      .where(and(eq(paymentRequests.id, String(req.params.id)), eq(paymentRequests.companyId, c.id)))
      .limit(1);
    if (!pr[0] || pr[0].status !== "checking") throw badRequest("not_checking", "This payment is not waiting for your confirmation.");
    await tx.update(paymentRequests).set({ status: "paid", paidAt: new Date() }).where(eq(paymentRequests.id, pr[0].id));
    await addActivity(tx, c.id, `Payment ${pr[0].ref} confirmed received.`, req.auth!.user!.id);
    return { ok: true, message: "Payment confirmed. The amount will be added to your books." };
  })));

  r.post("/founder/payments/:id/not-received", founder, handle((req) => asFounder(req, async (tx, c) => {
    const pr = await tx.select().from(paymentRequests)
      .where(and(eq(paymentRequests.id, String(req.params.id)), eq(paymentRequests.companyId, c.id)))
      .limit(1);
    if (!pr[0] || pr[0].status !== "checking") throw badRequest("not_checking", "This payment is not waiting for your confirmation.");
    const attempts = (pr[0].attempts ?? 0) + 1;
    const newStatus = attempts >= 2 ? "flagged" : "not_received";
    await tx.update(paymentRequests).set({ status: newStatus, attempts }).where(eq(paymentRequests.id, pr[0].id));
    if (newStatus === "flagged") {
      await addActivity(tx, c.id, `Payment ${pr[0].ref} flagged after second rejection.`, req.auth!.user!.id);
    }
    return { ok: true, message: newStatus === "flagged" ? "Flagged. The admin has been alerted." : "Noted. The client can send proof again." };
  })));

  r.post("/founder/payments/:id/cancel", founder, handle((req) => asFounder(req, async (tx, c) => {
    const pr = await tx.select().from(paymentRequests)
      .where(and(eq(paymentRequests.id, String(req.params.id)), eq(paymentRequests.companyId, c.id)))
      .limit(1);
    if (!pr[0]) throw badRequest("not_found", "Payment request not found.");
    if (!["waiting", "not_received"].includes(pr[0].status)) throw badRequest("cannot_cancel", "Only open payment requests can be cancelled.");
    await tx.update(paymentRequests).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(paymentRequests.id, pr[0].id));
    return { ok: true, message: "Payment request cancelled." };
  })));

  // ──────────────────────────────────────────────────────── FRAUD PROTECTION ──

  r.get("/founder/protection", founder, handle((req) => asFounder(req, async (tx, c) => {
    // Open fraud messages (unverified senders, risk flags)
    const fraudMessages = await tx.select().from(messages)
      .where(and(eq(messages.companyId, c.id), eq(messages.verifiedSender, false)))
      .orderBy(desc(messages.createdAt))
      .limit(20);
    // Watchlist hits for this company's messages
    const senderKeys = [...new Set(fraudMessages.map((m) => m.senderAddress).filter(Boolean))];
    const watchHits = senderKeys.length
      ? await tx.select().from(senderWatchlist).where(inArray(senderWatchlist.senderKey, senderKeys))
      : [];
    const watchMap = new Map(watchHits.map((w) => [w.senderKey, w]));
    // Pending payment details changes (the 24-hour hold)
    const recentDetailChanges = await tx.select().from(paymentDetails)
      .where(eq(paymentDetails.companyId, c.id))
      .orderBy(desc(paymentDetails.createdAt))
      .limit(5);
    return {
      messages: fraudMessages.map((m) => ({
        id: m.id,
        kind: m.kind,
        sender: m.sender,
        senderAddress: m.senderAddress,
        body: m.body,
        riskFlags: m.riskFlags,
        status: m.status,
        receivedOn: m.receivedOn,
        watchStatus: watchMap.get(m.senderAddress)?.status ?? null,
        watchReports: watchMap.get(m.senderAddress)?.reports ?? 0,
      })),
      detailChanges: recentDetailChanges.map((d) => ({
        id: d.id,
        bank: d.bank,
        accountName: d.accountName,
        accountLast4: d.accountLast4,
        changedAt: d.createdAt?.toISOString() ?? null,
      })),
      tips: [
        "PayShap and EFT only clear to accounts that match the name — check the name before confirming.",
        "A real buyer or funder never asks you to pay a fee upfront before releasing money.",
        "If a sender changed their phone number or bank recently, treat their messages with extra care.",
        "ProofPocket never contacts you by WhatsApp. Any message claiming to be from us is a scam.",
        "Always check the proof of payment in your banking app, not just the screenshot.",
      ],
    };
  })));

  /** Report a message sender as a scam. */
  r.post("/founder/protection/report", founder, handle((req) => asFounder(req, async (tx, c) => {
    const { messageId } = parse(z.object({ messageId: z.string().uuid() }), req.body);
    const msg = await tx.select().from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.companyId, c.id)))
      .limit(1);
    if (!msg[0]) throw badRequest("not_found", "Message not found.");
    // Upsert into watchlist
    const key = msg[0].senderAddress || msg[0].sender.toLowerCase().trim();
    await tx.insert(senderWatchlist).values({ senderKey: key, lastReportedAt: new Date() })
      .onConflictDoUpdate({ target: senderWatchlist.senderKey, set: { reports: sql`${senderWatchlist.reports} + 1`, lastReportedAt: new Date(), updatedAt: new Date() } });
    await tx.update(messages).set({ status: "blocked" }).where(eq(messages.id, messageId));
    await addActivity(tx, c.id, `Sender "${key}" reported as a scam.`, req.auth!.user!.id);
    return { ok: true, message: "Reported. We'll warn other businesses if this sender keeps coming up." };
  })));

  // ──────────────────────────────────────────────────────── PRIVACY & SHARING ──

  r.get("/founder/privacy", founder, handle((req) => asFounder(req, async (tx, c) => {
    return {
      sharing: c.funderSharing as FunderSharing,
      explanation: {
        none: "Funders and advisers cannot see your business. You won't appear in any pipeline.",
        summary: "Funders see your name, sector, town, readiness score and badge. They cannot see your books.",
        full: "Funders see everything: books, documents, readiness details. You get the best chance of matching.",
      },
    };
  })));

  const privacySchema = z.object({
    sharing: z.enum(["none", "summary", "full"]),
  });

  r.put("/founder/privacy", founder, handle((req) => asFounder(req, async (tx, c) => {
    const { sharing } = parse(privacySchema, req.body);
    await tx.update(companies).set({ funderSharing: sharing }).where(eq(companies.id, c.id));
    await addActivity(tx, c.id, `Sharing set to ${sharing}.`, req.auth!.user!.id);
    return { ok: true, message: "Privacy settings saved." };
  })));

  // ────────────────────────────────────────────────────── FUNDING READINESS ──

  r.get("/founder/funding", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const s = await loadSnapshot(tx, c.id);
    const { score, items } = readiness(s, today);
    const rm = recordMonths(s);
    // Active programmes from verified funders
    const progs = await tx.select({
      id: programmes.id, name: programmes.name,
      funderId: programmes.funderId, funderName: organisations.name,
      minAmount: programmes.minAmount, maxAmount: programmes.maxAmount,
      minMonths: programmes.minMonths, minScore: programmes.minScore,
      status: programmes.status,
    })
      .from(programmes)
      .innerJoin(organisations, eq(programmes.funderId, organisations.id))
      .where(eq(programmes.status, "open"))
      .orderBy(asc(programmes.minScore));
    const progReqs = progs.length
      ? await tx.select().from(programmeRequirements).where(inArray(programmeRequirements.programmeId, progs.map((p) => p.id)))
      : [];
    const reqsByProg = new Map<string, DocType[]>();
    for (const r of progReqs) {
      const arr = reqsByProg.get(r.programmeId) ?? [];
      arr.push(r.docType as DocType);
      reqsByProg.set(r.programmeId, arr);
    }
    // My applications
    const myApps = await tx.select({
      id: applications.id, programmeId: applications.programmeId,
      status: applications.status, requestedAmount: applications.requestedAmount,
      appliedOn: applications.appliedOn, statusReason: applications.statusReason,
    })
      .from(applications)
      .where(eq(applications.companyId, c.id));
    const myAppsByProg = new Map(myApps.map((a) => [a.programmeId, a]));
    const docs = s.docs;
    return {
      score, tone: scoreTone(score), label: scoreLabel(score),
      recordMonths: rm,
      items: items.map((i) => ({ ...i, ok: i.ok })),
      programmes: progs.map((p) => {
        const requiredDocs = reqsByProg.get(p.id) ?? [];
        const gaps = programmeGaps({ docs, recordMonths: rm, score }, { requiredDocs, minMonths: p.minMonths, minScore: p.minScore });
        const myApp = myAppsByProg.get(p.id);
        return {
          id: p.id, name: p.name, funderName: p.funderName,
          minAmount: Number(p.minAmount), maxAmount: Number(p.maxAmount),
          minMonths: p.minMonths, minScore: p.minScore,
          requiredDocs,
          gaps,
          eligible: gaps.length === 0,
          application: myApp ? { id: myApp.id, status: myApp.status, requestedAmount: Number(myApp.requestedAmount), appliedOn: myApp.appliedOn, statusReason: myApp.statusReason } : null,
        };
      }),
    };
  })));

  /** Apply to a funding programme. */
  const applySchema = z.object({
    programmeId: z.string().uuid(),
    amount: z.coerce.number().positive(),
  });

  r.post("/founder/funding/apply", founder, handle((req) => asFounder(req, async (tx, c) => {
    const { programmeId, amount } = parse(applySchema, req.body);
    const today = todayZA();
    const s = await loadSnapshot(tx, c.id);
    const rm = recordMonths(s);
    const { score } = readiness(s, today);
    const prog = await tx.select().from(programmes).where(eq(programmes.id, programmeId)).limit(1);
    if (!prog[0] || prog[0].status !== "open") throw badRequest("not_open", "This programme is not open for applications.");
    const reqDocs = await tx.select().from(programmeRequirements).where(eq(programmeRequirements.programmeId, programmeId));
    const requiredDocs = reqDocs.map((r) => r.docType as DocType);
    const alreadyApplied = !!(await tx.select({ id: applications.id }).from(applications)
      .where(and(eq(applications.companyId, c.id), eq(applications.programmeId, programmeId))).limit(1))[0];
    const check = canApply({ docs: s.docs, recordMonths: rm, score }, { requiredDocs, minMonths: prog[0].minMonths, minScore: prog[0].minScore, minAmount: Number(prog[0].minAmount), maxAmount: Number(prog[0].maxAmount) }, amount, alreadyApplied);
    if (!check.ok) throw badRequest(check.code, check.message);
    await tx.insert(applications).values({
      companyId: c.id,
      programmeId,
      funderId: prog[0].funderId,
      requestedAmount: String(amount),
      appliedOn: today,
    });
    await addActivity(tx, c.id, `Applied to programme "${prog[0].name}" for ${R(amount)}.`, req.auth!.user!.id);
    return { ok: true, message: `Application submitted to ${prog[0].name}.` };
  })));

  // ──────────────────────────────────────────────────────────── PROCUREMENT ──

  r.get("/founder/procurement", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const s = await loadSnapshot(tx, c.id);
    const rm = recordMonths(s);
    const { score } = readiness(s, today);
    const openTenders = await tx.select().from(tenders)
      .where(sql`${tenders.closesOn} >= ${today}`)
      .orderBy(asc(tenders.closesOn))
      .limit(30);
    const tenderReqs = openTenders.length
      ? await tx.select().from(tenderRequirements).where(inArray(tenderRequirements.tenderId, openTenders.map((t) => t.id)))
      : [];
    const reqsByTender = new Map<string, DocType[]>();
    for (const r of tenderReqs) {
      const arr = reqsByTender.get(r.tenderId) ?? [];
      arr.push(r.docType as DocType);
      reqsByTender.set(r.tenderId, arr);
    }
    const myInterests = await tx.select({ tenderId: tenderInterests.tenderId, status: tenderInterests.status })
      .from(tenderInterests).where(eq(tenderInterests.companyId, c.id));
    const myInterestMap = new Map(myInterests.map((i) => [i.tenderId, i.status]));
    // Buyers offering introductions
    const buyers = await tx.select({ id: organisations.id, name: organisations.name, sectors: organisations.sectors })
      .from(organisations).where(eq(organisations.kind, "buyer")).limit(20);
    const myIntros = await tx.select({ buyerId: introRequests.buyerId, status: introRequests.status })
      .from(introRequests).where(eq(introRequests.companyId, c.id));
    const myIntroMap = new Map(myIntros.map((i) => [i.buyerId, i.status]));
    return {
      score, recordMonths: rm,
      tenders: openTenders.map((t) => {
        const requiredDocs = reqsByTender.get(t.id) ?? [];
        const action = tenderAction({ docs: s.docs, recordMonths: rm, score }, { requiredDocs, minMonths: t.minMonths, sectors: t.sectors });
        return {
          id: t.id, title: t.title, buyerName: t.buyerName,
          value: Number(t.value), closesOn: t.closesOn,
          sectors: t.sectors, requiredDocs, action,
          myStatus: myInterestMap.get(t.id) ?? null,
        };
      }),
      buyers: buyers.map((b) => ({
        id: b.id, name: b.name, sectors: b.sectors,
        introStatus: myIntroMap.get(b.id) ?? null,
      })),
    };
  })));

  /** Express interest in a tender. */
  r.post("/founder/procurement/tenders/:id/interest", founder, handle((req) => asFounder(req, async (tx, c) => {
    const tenderId = String(req.params.id);
    const tender = await tx.select().from(tenders).where(eq(tenders.id, tenderId)).limit(1);
    if (!tender[0]) throw badRequest("not_found", "Tender not found.");
    await tx.insert(tenderInterests).values({ tenderId, companyId: c.id })
      .onConflictDoNothing();
    await addActivity(tx, c.id, `Expressed interest in tender "${tender[0].title}".`, req.auth!.user!.id);
    return { ok: true, message: "Interest registered. The buyer will be in touch." };
  })));

  /** Request an intro to a buyer. */
  r.post("/founder/procurement/buyers/:id/intro", founder, handle((req) => asFounder(req, async (tx, c) => {
    const buyerId = String(req.params.id);
    const buyer = await tx.select({ id: organisations.id, name: organisations.name }).from(organisations).where(eq(organisations.id, buyerId)).limit(1);
    if (!buyer[0]) throw badRequest("not_found", "Buyer not found.");
    await tx.insert(introRequests).values({ companyId: c.id, buyerId })
      .onConflictDoNothing();
    await addActivity(tx, c.id, `Requested intro to buyer "${buyer[0].name}".`, req.auth!.user!.id);
    return { ok: true, message: `Intro request sent to ${buyer[0].name}.` };
  })));

  // ─────────────────────────────────────────────── PROFILE & MARKETING ──

  r.get("/founder/markets", founder, handle((req) => asFounder(req, async (tx, c) => {
    const prof = await tx.select().from(profiles).where(eq(profiles.companyId, c.id)).limit(1);
    const recentPosts = await tx.select().from(posts)
      .where(eq(posts.companyId, c.id))
      .orderBy(desc(posts.postedOn))
      .limit(10);
    return {
      profile: prof[0] ? {
        tagline: prof[0].tagline,
        services: prof[0].services,
        whatsapp: prof[0].whatsapp,
        instagram: prof[0].instagram,
        hours: prof[0].hours,
      } : { tagline: "", services: "", whatsapp: "", instagram: "", hours: "" },
      company: {
        name: c.name, slug: c.slug, verified: c.verifiedAt !== null,
        publicLink: c.slug ? `${deps.config.WEB_ORIGIN}/b/${c.slug}` : null,
        qrData: c.slug ? `${deps.config.WEB_ORIGIN}/b/${c.slug}` : null,
      },
      posts: recentPosts.map((p) => ({
        id: p.id, text: p.text, postedOn: p.postedOn,
        sharedTo: p.sharedTo, feature: p.feature,
        featuredUntil: p.featuredUntil,
      })),
    };
  })));

  const profileSchema = z.object({
    tagline: z.string().trim().max(90).default(""),
    services: z.string().trim().max(500).default(""),
    whatsapp: z.string().trim().max(20).default(""),
    instagram: z.string().trim().max(50).default(""),
    hours: z.string().trim().max(100).default(""),
  });

  r.put("/founder/markets/profile", founder, handle((req) => asFounder(req, async (tx, c) => {
    const body = parse(profileSchema, req.body);
    await tx.insert(profiles).values({ companyId: c.id, ...body })
      .onConflictDoUpdate({ target: profiles.companyId, set: { ...body, updatedAt: new Date() } });
    await addActivity(tx, c.id, "Profile updated.", req.auth!.user!.id);
    return { ok: true, message: "Profile saved." };
  })));

  const postSchema = z.object({
    text: z.string().trim().min(1).max(400),
  });

  r.post("/founder/markets/posts", founder, handle((req) => asFounder(req, async (tx, c) => {
    const { text } = parse(postSchema, req.body);
    await tx.insert(posts).values({ companyId: c.id, text, postedOn: todayZA() });
    await addActivity(tx, c.id, "Post created.", req.auth!.user!.id);
    return { ok: true, message: "Post created. Share it from the post card." };
  })));

  r.delete("/founder/markets/posts/:id", founder, handle((req) => asFounder(req, async (tx, c) => {
    await tx.delete(posts).where(and(eq(posts.id, String(req.params.id)), eq(posts.companyId, c.id)));
    return { ok: true, message: "Post deleted." };
  })));

  return r;
}
