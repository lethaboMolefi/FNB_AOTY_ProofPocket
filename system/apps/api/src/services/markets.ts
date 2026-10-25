// Reaching formal markets, founder side (v2/app.js vMarkets, vFunding, vProcurement).
import { canApply, canAskReason, canWithdraw, DOCS, programmeGaps, R, scoreLabel, scoreTone, sectorMatch, tenderAction, todayZA, TENDER_DOCS, WITHDRAWN_BY_FOUNDER_REASON } from "@proofpocket/shared";
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { applications, introRequests, offers, organisations, posts, profiles, programmes, tenderInterests, tenderRequirements, tenders } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import type { CompanyRow } from "../repositories/companies";
import { applicationsWithOffers, eligibilityOf, programmeRules, programmesOf } from "./company-view";
import { loadSnapshot, summarise } from "./snapshot";

const verified = (c: CompanyRow) => c.verifiedAt !== null;
export const profileUrl = (config: Config, c: Pick<CompanyRow, "slug">) => `${config.PUBLIC_WEB_URL}/b/${c.slug}`;

// ---------------------------------------------------------------- profile, posts, buyers
export async function marketsView(tx: Tx, config: Config, c: CompanyRow) {
  const [p] = await tx.select().from(profiles).where(eq(profiles.companyId, c.id));
  const myPosts = await tx.select().from(posts).where(eq(posts.companyId, c.id)).orderBy(sql`${posts.postedOn} desc, ${posts.createdAt} desc`);
  const buyers = await tx.select().from(organisations).where(and(eq(organisations.type, "buyer"), eq(organisations.verified, true))).orderBy(asc(organisations.name));
  const intros = await tx.select().from(introRequests).where(eq(introRequests.companyId, c.id));
  return {
    verified: verified(c), url: profileUrl(config, c), name: c.name, hasIncubator: !!c.incubatorId,
    profile: { tagline: p?.tagline ?? "", services: p?.services ?? "", whatsapp: p?.whatsapp ?? "", instagram: p?.instagram ?? "", hours: p?.hours ?? "" },
    posts: myPosts.map((x) => ({ id: x.id, text: x.text, date: x.postedOn, shared: x.sharedTo, feature: x.feature, reviewNote: x.reviewNote })),
    buyers: buyers.map((b) => ({
      id: b.id, name: b.name, kind: b.kind, wants: b.wants, goodFit: sectorMatch(c.sector, b.sectors),
      requested: intros.find((i) => i.buyerId === b.id)?.status ?? null,
    })),
  };
}

export async function saveProfile(tx: Tx, actor: Actor, c: CompanyRow, p: { tagline: string; services: string; whatsapp: string; instagram: string; hours: string }) {
  await tx.insert(profiles).values({ companyId: c.id, ...p }).onConflictDoUpdate({ target: profiles.companyId, set: { ...p, updatedAt: new Date() } });
  await addActivity(tx, c.id, "Public profile updated.", actor.userId);
  return { message: "Profile saved" };
}

export async function createPost(tx: Tx, actor: Actor, c: CompanyRow, p: { text: string; requestFeature: boolean }) {
  if (p.requestFeature && !verified(c)) throw new AppError(403, "verified_only", "Only Verified businesses can ask for a feature.");
  await tx.insert(posts).values({ companyId: c.id, text: p.text, postedOn: todayZA(), feature: p.requestFeature ? "requested" : "none" });
  return { message: p.requestFeature ? "Saved. ProofPocket reviews feature requests weekly." : "Saved. Use the buttons to share it from your own accounts." };
}

/** Records where the founder shared a post (the share itself happens in their own app; no social media APIs). */
export async function markShared(tx: Tx, c: CompanyRow, id: string, net: string) {
  const [p] = await tx.select().from(posts).where(and(eq(posts.id, id), eq(posts.companyId, c.id)));
  if (!p) throw notFound("That post");
  if (!p.sharedTo.includes(net)) await tx.update(posts).set({ sharedTo: [...p.sharedTo, net] }).where(eq(posts.id, id));
  return { ok: true };
}

export async function requestIntro(tx: Tx, actor: Actor, c: CompanyRow, buyerId: string) {
  if (!verified(c)) throw new AppError(403, "verified_only", "Get verified first. Buyers meet Verified businesses.");
  const [b] = await tx.select().from(organisations).where(and(eq(organisations.id, buyerId), eq(organisations.type, "buyer"), eq(organisations.verified, true)));
  if (!b) throw notFound("That buyer");
  await tx.insert(introRequests).values({ companyId: c.id, buyerId }).onConflictDoNothing();
  await addActivity(tx, c.id, `Asked for an introduction to ${b.name}.`, actor.userId);
  return { message: c.incubatorId ? "Your adviser will arrange the introduction" : "ProofPocket will arrange the introduction" };
}

// ---------------------------------------------------------------- funding
export async function fundingView(tx: Tx, c: CompanyRow) {
  const today = todayZA();
  const s = await loadSnapshot(tx, c.id);
  const sum = summarise(s, today);
  const elig = eligibilityOf(s, today);
  const funders = await tx.select().from(organisations).where(and(eq(organisations.type, "funder"), eq(organisations.verified, true)));
  const progs = (await programmesOf(tx, eq(programmes.status, "open"))).filter((p) => funders.some((f) => f.id === p.funderId));
  const mine = await applicationsWithOffers(tx, eq(applications.companyId, c.id));
  return {
    verified: verified(c),
    readiness: { score: sum.readiness.score, label: scoreLabel(sum.readiness.score), tone: scoreTone(sum.readiness.score), items: sum.readiness.items },
    programmes: progs.map((p) => {
      const f = funders.find((x) => x.id === p.funderId)!;
      return {
        id: p.id, name: p.name, funder: f.name, kind: f.kind, min: Number(p.minAmount), max: Number(p.maxAmount),
        left: Number(p.budget) - Number(p.committed), gaps: programmeGaps(elig, programmeRules(p)),
        applied: mine.some((a) => a.programmeId === p.id),
      };
    }).sort((a, b) => a.gaps.length - b.gaps.length),
    applications: mine.map((a) => ({ ...a, canAskReason: canAskReason(a.offers, a.reasonRequested), canWithdraw: canWithdraw(a.status) })),
  };
}

export async function apply(tx: Tx, actor: Actor, c: CompanyRow, programmeId: string, amount: number) {
  const [p] = await programmesOf(tx, eq(programmes.id, programmeId));
  if (!p || p.status !== "open") throw notFound("That programme");
  const s = await loadSnapshot(tx, c.id);
  const existing = await tx.select({ id: applications.id }).from(applications).where(and(eq(applications.companyId, c.id), eq(applications.programmeId, p.id)));
  const check = canApply(eligibilityOf(s), programmeRules(p), amount, existing.length > 0);
  if (!check.ok) throw badRequest(check.code, check.message);
  const [funder] = await tx.select().from(organisations).where(eq(organisations.id, p.funderId));
  const [a] = await tx.insert(applications).values({ companyId: c.id, programmeId: p.id, funderId: p.funderId, requestedAmount: amount.toFixed(2), appliedOn: todayZA() }).returning();
  await tx.insert(offers).values({ applicationId: a!.id, amount: amount.toFixed(2), reason: "Requested amount", changedBy: actor.userId, offeredOn: todayZA() });
  await addActivity(tx, c.id, `Applied to ${p.name} for ${R(amount)}.`, actor.userId);
  await audit(tx, actor, { action: "application.submitted", entity: "application", entityId: a!.id, companyId: c.id, after: { programme: p.name, amount } });
  return { message: `Application sent to ${funder!.name}` };
}

async function ownApplication(tx: Tx, c: CompanyRow, id: string) {
  const [a] = await applicationsWithOffers(tx, and(eq(applications.id, id), eq(applications.companyId, c.id)));
  if (!a) throw notFound("That application");
  return a;
}

export async function askReason(tx: Tx, actor: Actor, c: CompanyRow, id: string) {
  const a = await ownApplication(tx, c, id);
  if (!canAskReason(a.offers, a.reasonRequested)) throw badRequest("no_reason_needed", "There's no unexplained change to ask about.");
  await tx.update(applications).set({ reasonRequested: true }).where(eq(applications.id, a.id));
  await addActivity(tx, c.id, "Asked the funder to explain the change to the offer.", actor.userId);
  await audit(tx, actor, { action: "application.reason_requested", entity: "application", entityId: a.id, companyId: c.id });
  return { message: "Request sent to the funder" };
}

export async function withdraw(tx: Tx, actor: Actor, c: CompanyRow, id: string) {
  const a = await ownApplication(tx, c, id);
  if (!canWithdraw(a.status)) throw badRequest("decided", "This application has already been decided.");
  await tx.update(applications).set({ status: "withdrawn", statusReason: WITHDRAWN_BY_FOUNDER_REASON }).where(eq(applications.id, a.id));
  await addActivity(tx, c.id, `Withdrew the ${a.programme} application.`, actor.userId);
  await audit(tx, actor, { action: "application.withdrawn", entity: "application", entityId: a.id, companyId: c.id });
  return { message: "Application withdrawn" };
}

// ---------------------------------------------------------------- procurement
export async function procurementView(tx: Tx, c: CompanyRow) {
  const today = todayZA();
  const s = await loadSnapshot(tx, c.id);
  const elig = eligibilityOf(s, today);
  const open = await tx.select().from(tenders).where(gte(tenders.closesOn, today)).orderBy(asc(tenders.closesOn));
  const reqs = open.length ? await tx.select().from(tenderRequirements).where(inArray(tenderRequirements.tenderId, open.map((t) => t.id))) : [];
  const mine = await tx.select().from(tenderInterests).where(eq(tenderInterests.companyId, c.id));
  return {
    recordMonths: elig.recordMonths, verified: verified(c),
    tenderDocs: TENDER_DOCS.filter((k) => s.docs[k] === "verified").length,
    tenders: open.map((t) => {
      const req = reqs.filter((r) => r.tenderId === t.id).map((r) => r.docType);
      return {
        id: t.id, title: t.title, buyer: t.buyerName, value: Number(t.value), closesOn: t.closesOn, months: t.minMonths, yourSector: sectorMatch(c.sector, t.sectors),
        requirements: req.map((k) => ({ docType: k, short: DOCS[k].short, ok: s.docs[k] === "verified" })),
        monthsOk: elig.recordMonths >= t.minMonths,
        action: tenderAction(elig, { requiredDocs: req, minMonths: t.minMonths, sectors: t.sectors }),
        interest: mine.find((i) => i.tenderId === t.id)?.status ?? null,
      };
    }),
  };
}

export async function expressInterest(tx: Tx, actor: Actor, c: CompanyRow, tenderId: string) {
  const v = await procurementView(tx, c);
  const t = v.tenders.find((x) => x.id === tenderId);
  if (!t) throw notFound("That tender");
  if (t.action.kind !== "can_express") throw badRequest("not_eligible", "You don't meet this tender's requirements yet.");
  await tx.insert(tenderInterests).values({ tenderId, companyId: c.id }).onConflictDoNothing();
  await addActivity(tx, c.id, `Expressed interest in "${t.title}".`, actor.userId);
  return { message: "Interest sent with your checked documents and track record" };
}
