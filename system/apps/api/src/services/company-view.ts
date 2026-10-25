// The company drawer for funders and advisers (v2/app.js drawerHTML, funderDrawerPart).
// What the viewer may see is decided by row-level security: funders get book entries only with full sharing.
import {
  APPLICATION_STATUS, cashOnHand, DOC_TYPES, DOCS, lastEntryDays, programmeGaps, scoreLabel, scoreTone, STAGES, todayZA, type CompanySnapshot,
} from "@proofpocket/shared";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Tx } from "../db/client";
import { activity, applications, companies, ledgerEntries, offers, organisations, programmeRequirements, programmes, supportLogs, users } from "../db/schema/index";
import { notFound } from "../lib/errors";
import { entryView } from "./books";
import { loadSnapshot, loadSnapshots, summarise } from "./snapshot";

export type ProgrammeRow = typeof programmes.$inferSelect & { requiredDocs: (typeof programmeRequirements.$inferSelect)["docType"][] };

export async function programmesOf(tx: Tx, where: SQL | undefined) {
  const rows = await tx.select().from(programmes).where(where).orderBy(programmes.createdAt);
  const reqs = rows.length ? await tx.select().from(programmeRequirements).where(inArray(programmeRequirements.programmeId, rows.map((p) => p.id))) : [];
  return rows.map((p): ProgrammeRow => ({ ...p, requiredDocs: reqs.filter((r) => r.programmeId === p.id).map((r) => r.docType) }));
}

export const eligibilityOf = (s: CompanySnapshot, today = todayZA()) => {
  const sum = summarise(s, today);
  return { docs: s.docs, recordMonths: sum.recordMonths, score: sum.readiness.score };
};

export const programmeRules = (p: ProgrammeRow) => ({
  requiredDocs: p.requiredDocs, minMonths: p.minMonths, minScore: p.minScore, minAmount: Number(p.minAmount), maxAmount: Number(p.maxAmount),
});

/** The figures every list row shows (pipeline, cohort board). */
export function rowFigures(s: CompanySnapshot, today = todayZA()) {
  const sum = summarise(s, today);
  const last = lastEntryDays(s.entries, today);
  return {
    score: sum.readiness.score, label: scoreLabel(sum.readiness.score), tone: scoreTone(sum.readiness.score),
    flags: sum.flags, spark: sum.series.slice(0, 5).map((m) => m.moneyIn), lastEntryDays: Number.isFinite(last) ? last : null, recordMonths: sum.recordMonths,
  };
}

export async function snapshotsFor(tx: Tx, ids: string[]) { return loadSnapshots(tx, ids); }

export async function applicationsWithOffers(tx: Tx, where: SQL | undefined) {
  const apps = await tx.select({ a: applications, programme: programmes.name, funder: organisations.name, company: companies.name })
    .from(applications).innerJoin(programmes, eq(programmes.id, applications.programmeId)).innerJoin(organisations, eq(organisations.id, applications.funderId))
    .innerJoin(companies, eq(companies.id, applications.companyId)).where(where).orderBy(desc(applications.appliedOn));
  const all = apps.length ? await tx.select().from(offers).where(inArray(offers.applicationId, apps.map((x) => x.a.id))).orderBy(offers.offeredOn, offers.createdAt) : [];
  return apps.map(({ a, programme, funder, company }) => {
    const history = all.filter((o) => o.applicationId === a.id).map((o) => ({ amount: Number(o.amount), date: o.offeredOn, reason: o.reason }));
    const current = history[history.length - 1];
    return {
      id: a.id, companyId: a.companyId, company, programmeId: a.programmeId, programme, funderId: a.funderId, funder,
      requested: Number(a.requestedAmount), appliedOn: a.appliedOn, status: a.status, statusLabel: APPLICATION_STATUS[a.status].label, statusTone: APPLICATION_STATUS[a.status].tone,
      statusReason: a.statusReason, reasonRequested: a.reasonRequested, offers: history, currentOffer: current?.amount ?? Number(a.requestedAmount),
      changedWithoutReason: history.length > 1 && !current!.reason.trim(),
    };
  });
}

/** Drawer data. `viewer` decides the extra parts: a funder's own applications, or an adviser's controls. */
export async function companyDrawer(tx: Tx, companyId: string, viewer: { role: "funder" | "adviser" | "admin"; orgId: string | null }) {
  const today = todayZA();
  const [c] = await tx.select().from(companies).where(eq(companies.id, companyId));
  if (!c) throw notFound("That company");
  const s = await loadSnapshot(tx, companyId);
  const sum = summarise(s, today);
  const five = sum.series.slice(0, 5);
  const active = five.filter((m) => m.moneyIn + m.moneyOut > 0);
  const inc5 = five.reduce((a, m) => a + m.moneyIn, 0), exp5 = five.reduce((a, m) => a + m.moneyOut, 0);
  // Returns rows only when the viewer may see them (advisers always; funders with full sharing).
  const recent = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.companyId, companyId)).orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt)).limit(8);
  const showEntries = viewer.role !== "funder" || c.funderSharing === "full";
  const incubator = c.incubatorId ? (await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, c.incubatorId)))[0]?.name ?? null : null;
  const adviser = c.adviserId ? (await tx.select({ name: users.displayName }).from(users).where(eq(users.id, c.adviserId)))[0]?.name ?? null : null;
  const logs = await tx.select().from(supportLogs).where(eq(supportLogs.companyId, companyId)).orderBy(desc(supportLogs.logDate), desc(supportLogs.createdAt));
  const acts = await tx.select().from(activity).where(eq(activity.companyId, companyId)).orderBy(desc(activity.createdAt)).limit(8);

  const base = {
    company: {
      id: c.id, name: c.name, sector: c.sector, town: c.town, province: c.province, area: c.area, cipcNumber: c.cipcNumber, stage: c.stage,
      employees: c.employees, verified: c.verifiedAt !== null, sharing: c.funderSharing, recordMonths: sum.recordMonths,
    },
    readiness: { score: sum.readiness.score, label: scoreLabel(sum.readiness.score), tone: scoreTone(sum.readiness.score), items: sum.readiness.items },
    documentsChecked: DOC_TYPES.filter((k) => s.docs[k] === "verified").length,
    figures: { income5: inc5, avgProfit: (inc5 - exp5) / Math.max(1, active.length), cash: cashOnHand(s), people: c.employees },
    flags: sum.flags, series: sum.series,
    entries: showEntries ? recent.map(entryView) : null,
    documents: DOC_TYPES.map((k) => ({ docType: k, name: DOCS[k].name, state: s.docs[k] })),
    support: {
      incubator, stage: c.supportStage, stageName: STAGES[c.supportStage], adviser, adviserId: c.adviserId,
      logs: logs.map((l) => ({ id: l.id, date: l.logDate, type: l.supportType, note: l.note })),
    },
    activity: acts.map((a) => ({ date: a.createdAt, text: a.text })),
  };

  if (viewer.role === "funder" && viewer.orgId) {
    const apps = await applicationsWithOffers(tx, and(eq(applications.companyId, companyId), eq(applications.funderId, viewer.orgId)));
    const progs = await programmesOf(tx, eq(programmes.funderId, viewer.orgId));
    const elig = eligibilityOf(s, today);
    const invitable = progs.filter((p) => p.status === "open" && !apps.some((a) => a.programmeId === p.id))
      .map((p) => ({ id: p.id, name: p.name, gaps: programmeGaps(elig, programmeRules(p)).length }));
    return { ...base, applications: apps, invitable };
  }
  if (viewer.role === "adviser" && viewer.orgId) {
    const advisers = await tx.select({ id: users.id, name: users.displayName }).from(users).where(and(eq(users.orgId, viewer.orgId), eq(users.role, "adviser"))).orderBy(users.displayName);
    return { ...base, advisers, stages: STAGES };
  }
  return base;
}
