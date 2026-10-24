// Funder and investor portal (v2/app.js funderSetup, funderPipeline, funderApplications, funderProgrammes, offer/approve/decline/invite).
// Every decision is written to audit_log; offer changes and declines need reasons.
import { budgetCheck, isDecided, offerNeedsReason, programmeGaps, R, type DocType } from "@proofpocket/shared";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { applications, companies, messages, offers, organisations, programmeRequirements, programmes } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import { applicationsWithOffers, eligibilityOf, programmeRules, programmesOf, rowFigures } from "./company-view";
import { loadSnapshots } from "./snapshot";

export async function funderOrg(tx: Tx, orgId: string) {
  const [o] = await tx.select().from(organisations).where(and(eq(organisations.id, orgId), eq(organisations.type, "funder")));
  if (!o) throw new AppError(403, "no_org", "Your account isn't linked to a funder.");
  return o;
}

export async function requireSetup(tx: Tx, orgId: string) {
  const o = await funderOrg(tx, orgId);
  if (!o.setupDone) throw new AppError(409, "setup_needed", "Set your requirements first.");
  if (!o.verified) throw new AppError(403, "not_verified", "ProofPocket is still verifying your organisation.");
  return o;
}

type ProgrammeInput = { name: string; kind: string; minAmount: number; maxAmount: number; budget: number; minMonths: number; minScore: number; requiredDocs: DocType[] };

/** First-time set-up and "Add a programme" share this. */
export async function addProgramme(tx: Tx, actor: Actor, orgId: string, p: ProgrammeInput) {
  const o = await funderOrg(tx, orgId);
  const [row] = await tx.insert(programmes).values({
    funderId: o.id, name: p.name, minAmount: p.minAmount.toFixed(2), maxAmount: p.maxAmount.toFixed(2), budget: p.budget.toFixed(2),
    minMonths: p.minMonths, minScore: p.minScore,
  }).returning();
  if (p.requiredDocs.length) await tx.insert(programmeRequirements).values([...new Set(p.requiredDocs)].map((docType) => ({ programmeId: row!.id, docType })));
  await tx.update(organisations).set({ kind: p.kind, setupDone: true }).where(eq(organisations.id, o.id));
  await audit(tx, actor, { action: "programme.created", entity: "programme", entityId: row!.id, after: p });
  return { message: "Requirements saved. Founders can see them now." };
}

/** Companies a funder may see; the pipeline lists Verified ones that share (applicants with sharing "none" appear under Applications only). */
async function visibleCompanies(tx: Tx) {
  return tx.select().from(companies).where(and(isNotNull(companies.verifiedAt), ne(companies.funderSharing, "none"), isNotNull(companies.joinedAt)));
}

export async function pipeline(tx: Tx, orgId: string) {
  const o = await requireSetup(tx, orgId);
  const list = await visibleCompanies(tx);
  const snaps = await loadSnapshots(tx, list.map((c) => c.id));
  const progs = (await programmesOf(tx, eq(programmes.funderId, o.id))).filter((p) => p.status === "open");
  const rows = list.filter((c) => snaps.has(c.id)).map((c) => {
    const s = snaps.get(c.id)!;
    const elig = eligibilityOf(s);
    const f = rowFigures(s);
    return {
      id: c.id, name: c.name, sector: c.sector, stage: c.stage, town: c.town, area: c.area, sharing: c.funderSharing,
      score: f.score, spark: f.spark, lastEntryDays: f.lastEntryDays,
      qualifies: progs.filter((p) => programmeGaps(elig, programmeRules(p)).length === 0).length,
    };
  }).sort((a, b) => b.score - a.score);
  const total = (await tx.execute<{ n: number }>(sql`select joined_company_count() as n`)).rows[0]!.n;
  const apps = await tx.select({ n: sql<number>`count(*)::int` }).from(applications).where(eq(applications.funderId, o.id));
  return {
    funder: { name: o.name, kind: o.kind },
    tiles: { visible: rows.length, hidden: Math.max(0, total - rows.length), qualify: rows.filter((r) => r.qualifies > 0).length, ready: rows.filter((r) => r.score >= 70).length, applications: apps[0]!.n },
    sectors: [...new Set(rows.map((r) => r.sector))].sort(),
    rows,
  };
}

export async function applicationsList(tx: Tx, orgId: string) {
  const o = await requireSetup(tx, orgId);
  const apps = await applicationsWithOffers(tx, eq(applications.funderId, o.id));
  const snaps = await loadSnapshots(tx, [...new Set(apps.map((a) => a.companyId))]);
  return { funder: { name: o.name }, applications: apps.map((a) => ({ ...a, score: snaps.has(a.companyId) ? rowFigures(snaps.get(a.companyId)!).score : null })) };
}

export async function programmesView(tx: Tx, orgId: string) {
  const o = await funderOrg(tx, orgId);
  const progs = await programmesOf(tx, eq(programmes.funderId, o.id));
  const list = o.setupDone ? await visibleCompanies(tx) : [];
  const snaps = await loadSnapshots(tx, list.map((c) => c.id));
  return {
    funder: { name: o.name, kind: o.kind, setupDone: o.setupDone },
    programmes: progs.map((p) => ({
      id: p.id, name: p.name, status: p.status, min: Number(p.minAmount), max: Number(p.maxAmount), budget: Number(p.budget), committed: Number(p.committed),
      left: Number(p.budget) - Number(p.committed), minMonths: p.minMonths, minScore: p.minScore, requiredDocs: p.requiredDocs,
      qualify: [...snaps.values()].filter((s) => programmeGaps(eligibilityOf(s), programmeRules(p)).length === 0).length,
    })),
  };
}

async function ownProgramme(tx: Tx, orgId: string, id: string) {
  const [p] = await programmesOf(tx, and(eq(programmes.id, id), eq(programmes.funderId, orgId)));
  if (!p) throw notFound("That programme");
  return p;
}

export async function toggleRequirement(tx: Tx, actor: Actor, orgId: string, id: string, docType: DocType) {
  const p = await ownProgramme(tx, orgId, id);
  if (p.requiredDocs.includes(docType)) await tx.delete(programmeRequirements).where(and(eq(programmeRequirements.programmeId, p.id), eq(programmeRequirements.docType, docType)));
  else await tx.insert(programmeRequirements).values({ programmeId: p.id, docType });
  await audit(tx, actor, { action: "programme.requirement_toggled", entity: "programme", entityId: p.id, after: { docType, required: !p.requiredDocs.includes(docType) } });
  return { message: "Requirements updated; founders see the change" };
}

export async function setProgrammeStatus(tx: Tx, actor: Actor, orgId: string, id: string, status: "open" | "closed") {
  const p = await ownProgramme(tx, orgId, id);
  await tx.update(programmes).set({ status }).where(eq(programmes.id, p.id));
  await audit(tx, actor, { action: `programme.${status}`, entity: "programme", entityId: p.id });
  return { message: status === "closed" ? "Programme closed to new applications" : "Programme open again" };
}

// ---------------------------------------------------------------- decisions
async function ownApplication(tx: Tx, orgId: string, id: string) {
  const [a] = await applicationsWithOffers(tx, and(eq(applications.id, id), eq(applications.funderId, orgId)));
  if (!a) throw notFound("That application");
  if (isDecided(a.status)) throw new AppError(409, "decided", "This application has already been decided.");
  return a;
}

export async function changeOffer(tx: Tx, actor: Actor, orgId: string, id: string, amount: number, reason: string) {
  const a = await ownApplication(tx, orgId, id);
  if (offerNeedsReason(false, reason)) throw badRequest("reason_needed", "Add a reason. Founders see every change to their offer.");
  await tx.insert(offers).values({ applicationId: a.id, amount: amount.toFixed(2), reason, changedBy: actor.userId });
  await tx.update(applications).set({ status: "offer_made", reasonRequested: false }).where(eq(applications.id, a.id));
  const [o] = await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, orgId));
  await addActivity(tx, a.companyId, `${o!.name} changed the offer to ${R(amount)}: ${reason}`, actor.userId);
  await audit(tx, actor, { action: "offer.changed", entity: "application", entityId: a.id, companyId: a.companyId, before: { amount: a.currentOffer }, after: { amount, reason } });
  return { message: "Offer updated and shared with the founder" };
}

export async function setStatus(tx: Tx, actor: Actor, orgId: string, id: string, status: "under_review" | "awaiting_cofunding", reason: string) {
  const a = await ownApplication(tx, orgId, id);
  if (status === "awaiting_cofunding" && !reason.trim()) throw badRequest("reason_needed", "Say what co-funding the founder needs to find.");
  await tx.update(applications).set({ status, statusReason: reason }).where(eq(applications.id, a.id));
  await addActivity(tx, a.companyId, `${a.funder}: ${a.programme} application is now "${status === "under_review" ? "Under review" : "Awaiting co-funding"}".${reason ? ` ${reason}` : ""}`, actor.userId);
  await audit(tx, actor, { action: `application.${status}`, entity: "application", entityId: a.id, companyId: a.companyId, after: { reason } });
  return { message: "Status updated" };
}

/** Approving commits the current offer to the programme budget (inventory 12.8). */
export async function approve(tx: Tx, actor: Actor, orgId: string, id: string, reason: string, confirmOverBudget: boolean) {
  const a = await ownApplication(tx, orgId, id);
  const p = await ownProgramme(tx, orgId, a.programmeId);
  const b = budgetCheck({ budget: Number(p.budget), committed: Number(p.committed) }, a.currentOffer);
  if (b.exceeds && !confirmOverBudget) throw new AppError(409, "over_budget", `Approving ${R(a.currentOffer)} goes over what's left of this programme's budget (${R(b.left)}). Approve anyway?`);
  await tx.update(applications).set({ status: "approved", statusReason: reason || "Approved at the current offer." }).where(eq(applications.id, a.id));
  await tx.update(programmes).set({ committed: sql`${programmes.committed} + ${a.currentOffer.toFixed(2)}` }).where(eq(programmes.id, p.id));
  await addActivity(tx, a.companyId, `${a.funder} approved the ${a.programme} application.`, actor.userId);
  await audit(tx, actor, { action: "application.approved", entity: "application", entityId: a.id, companyId: a.companyId, after: { amount: a.currentOffer, reason, overBudget: b.exceeds } });
  return { message: "Application approved" };
}

export async function decline(tx: Tx, actor: Actor, orgId: string, id: string, reason: string) {
  const a = await ownApplication(tx, orgId, id);
  await tx.update(applications).set({ status: "declined", statusReason: reason }).where(eq(applications.id, a.id));
  await addActivity(tx, a.companyId, `${a.funder} declined the ${a.programme} application.`, actor.userId);
  await audit(tx, actor, { action: "application.declined", entity: "application", entityId: a.id, companyId: a.companyId, after: { reason } });
  return { message: "Application declined" };
}

export async function invite(tx: Tx, actor: Actor, orgId: string, companyId: string, programmeId: string) {
  await requireSetup(tx, orgId);
  const p = await ownProgramme(tx, orgId, programmeId);
  const [c] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId));
  if (!c) throw notFound("That company");
  const [o] = await tx.select().from(organisations).where(eq(organisations.id, orgId));
  await tx.insert(messages).values({
    companyId, kind: "organisation", sender: o!.name, senderAddress: "Verified funder", senderOrgId: o!.id, verifiedSender: true,
    body: `You're invited to apply to ${p.name}. Check Funding readiness for what's needed.`,
  });
  await addActivity(tx, companyId, `${o!.name} invited you to apply to ${p.name}.`, actor.userId);
  await audit(tx, actor, { action: "application.invited", entity: "programme", entityId: p.id, companyId });
  return { message: "Invite sent" };
}
