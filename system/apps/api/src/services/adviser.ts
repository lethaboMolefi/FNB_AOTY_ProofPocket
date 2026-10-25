// Incubator and NGO portal (v2/app.js ngoCohort, ngoAttention, ngoSupport, advance/stageback, adviser select).
import { byUrgency, STAGES, STARTER_FLAG, type SUPPORT_TYPES } from "@proofpocket/shared";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, introRequests, organisations, supportLogs, tenderInterests, tenders, users } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import { rowFigures } from "./company-view";
import { reviewQueue } from "./documents";
import { loadSnapshots } from "./snapshot";

export async function incubatorOrg(tx: Tx, orgId: string | null) {
  if (!orgId) throw new AppError(403, "no_org", "Your account isn't linked to an incubator.");
  const [o] = await tx.select().from(organisations).where(and(eq(organisations.id, orgId), eq(organisations.type, "incubator")));
  if (!o) throw new AppError(403, "no_org", "Your account isn't linked to an incubator.");
  return o;
}

async function cohortRows(tx: Tx, orgId: string) {
  const list = await tx.select({ c: companies, adviser: users.displayName }).from(companies).leftJoin(users, eq(users.id, companies.adviserId))
    .where(and(eq(companies.incubatorId, orgId), isNotNull(companies.joinedAt))).orderBy(companies.name);
  const snaps = await loadSnapshots(tx, list.map((x) => x.c.id));
  return list.filter((x) => snaps.has(x.c.id)).map(({ c, adviser }) => {
    const f = rowFigures(snaps.get(c.id)!);
    return { id: c.id, name: c.name, sector: c.sector, town: c.town, stage: c.supportStage, verified: c.verifiedAt !== null, adviser, score: f.score, flags: f.flags };
  });
}

export async function cohort(tx: Tx, orgId: string | null) {
  const o = await incubatorOrg(tx, orgId);
  const rows = await cohortRows(tx, o.id);
  const logs = await tx.select({ n: sql<number>`count(*)::int` }).from(supportLogs).where(eq(supportLogs.incubatorId, o.id));
  const requests = (await tx.execute<{ membership_id: string; name: string; sector: string; town: string; requested_at: string }>(sql`select * from incubator_requests()`)).rows;
  return {
    incubator: o.name, stages: STAGES,
    tiles: {
      companies: rows.length, starters: rows.filter((r) => !r.verified).length,
      avgReadiness: rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0,
      toCheck: (await reviewQueue(tx, "adviser")).length, sessions: logs[0]!.n,
    },
    companies: rows.map((r) => ({ ...r, flags: r.flags.filter((f) => f.code !== STARTER_FLAG) })),
    requests: requests.map((r) => ({ id: r.membership_id, name: r.name, sector: r.sector, town: r.town, requestedAt: r.requested_at })),
  };
}

export async function attention(tx: Tx, orgId: string | null) {
  const o = await incubatorOrg(tx, orgId);
  const rows = await cohortRows(tx, o.id);
  return { incubator: o.name, items: byUrgency(rows.flatMap((r) => r.flags.map((f) => ({ ...f, companyId: r.id, company: r.name })))) };
}

export async function supportView(tx: Tx, orgId: string | null) {
  const o = await incubatorOrg(tx, orgId);
  const rows = await cohortRows(tx, o.id);
  const ids = rows.map((r) => r.id);
  const logs = ids.length ? await tx.select({ l: supportLogs, company: companies.name }).from(supportLogs).innerJoin(companies, eq(companies.id, supportLogs.companyId))
    .where(inArray(supportLogs.companyId, ids)).orderBy(desc(supportLogs.logDate), desc(supportLogs.createdAt)) : [];
  const intros = ids.length ? await tx.select({ i: introRequests, company: companies.name, buyer: organisations.name }).from(introRequests)
    .innerJoin(companies, eq(companies.id, introRequests.companyId)).innerJoin(organisations, eq(organisations.id, introRequests.buyerId))
    .where(inArray(introRequests.companyId, ids)).orderBy(desc(introRequests.createdAt)) : [];
  const interests = ids.length ? await tx.select({ t: tenderInterests, company: companies.name, title: tenders.title }).from(tenderInterests)
    .innerJoin(companies, eq(companies.id, tenderInterests.companyId)).innerJoin(tenders, eq(tenders.id, tenderInterests.tenderId))
    .where(inArray(tenderInterests.companyId, ids)).orderBy(desc(tenderInterests.createdAt)) : [];
  return {
    incubator: o.name,
    companies: rows.map((r) => ({ id: r.id, name: r.name })),
    logs: logs.map(({ l, company }) => ({ id: l.id, company, date: l.logDate, type: l.supportType, note: l.note })),
    intros: intros.map(({ i, company, buyer }) => ({ id: i.id, company, buyer, status: i.status, note: i.note })),
    tenderInterests: interests.map(({ t, company, title }) => ({ id: t.id, company, title, status: t.status })),
  };
}

async function cohortCompany(tx: Tx, orgId: string, id: string) {
  const [c] = await tx.select().from(companies).where(and(eq(companies.id, id), eq(companies.incubatorId, orgId)));
  if (!c) throw notFound("That company");
  return c;
}

export async function logSupport(tx: Tx, actor: Actor, orgId: string | null, l: { companyId: string; type: (typeof SUPPORT_TYPES)[number]; note: string }) {
  const o = await incubatorOrg(tx, orgId);
  const c = await cohortCompany(tx, o.id, l.companyId);
  await tx.insert(supportLogs).values({ companyId: c.id, incubatorId: o.id, adviserId: actor.userId, supportType: l.type, note: l.note });
  await addActivity(tx, c.id, `${o.name}: ${l.type}.`, actor.userId);
  return { message: "Support logged" };
}

export async function assignAdviser(tx: Tx, actor: Actor, orgId: string | null, companyId: string, adviserId: string | null) {
  const o = await incubatorOrg(tx, orgId);
  const c = await cohortCompany(tx, o.id, companyId);
  let name: string | null = null;
  if (adviserId) {
    const [a] = await tx.select().from(users).where(and(eq(users.id, adviserId), eq(users.orgId, o.id), eq(users.role, "adviser")));
    if (!a) throw badRequest("unknown_adviser", "Choose an adviser from your incubator.");
    name = a.displayName;
  }
  // Assigning an adviser moves a company out of Assessment (v2).
  await tx.update(companies).set({ adviserId, supportStage: adviserId && c.supportStage === 0 ? 1 : c.supportStage }).where(eq(companies.id, c.id));
  await addActivity(tx, c.id, name ? `Adviser ${name} assigned.` : "Adviser removed.", actor.userId);
  return { message: name ? "Adviser assigned" : "Adviser removed" };
}

export async function moveStage(tx: Tx, actor: Actor, orgId: string | null, companyId: string, direction: "forward" | "back") {
  const o = await incubatorOrg(tx, orgId);
  const c = await cohortCompany(tx, o.id, companyId);
  const stage = Math.max(0, Math.min(STAGES.length - 1, c.supportStage + (direction === "forward" ? 1 : -1)));
  await tx.update(companies).set({ supportStage: stage }).where(eq(companies.id, c.id));
  await addActivity(tx, c.id, `Support stage: ${STAGES[stage]}.`, actor.userId);
  return { message: `Moved to ${STAGES[stage]}` };
}

export async function decideMembership(tx: Tx, actor: Actor, orgId: string | null, membershipId: string, accept: boolean) {
  const o = await incubatorOrg(tx, orgId);
  const r = await tx.execute<{ company_id: string }>(sql`select decide_membership(${membershipId}, ${accept}) as company_id`);
  const companyId = r.rows[0]!.company_id;
  if (accept) await addActivity(tx, companyId, `${o.name} accepted you. Your adviser can now see your records to help.`, actor.userId);
  await audit(tx, actor, { action: accept ? "membership.accepted" : "membership.declined", entity: "company", entityId: companyId, companyId });
  return { message: accept ? "Company added to your cohort" : "Request declined" };
}

/** Introductions and tender interest: advisers for their cohort (admin for companies without an incubator). */
export async function handleRequest(tx: Tx, actor: Actor, kind: "intro" | "tender", id: string, status: "arranged" | "declined", note: string) {
  const table = kind === "intro" ? introRequests : tenderInterests;
  const [row] = await tx.select().from(table).where(eq(table.id, id));
  if (!row) throw notFound("That request");
  await tx.update(table).set({ status, handledBy: actor.userId, ...(kind === "intro" ? { note } : {}) }).where(eq(table.id, id));
  await addActivity(tx, row.companyId, kind === "intro"
    ? (status === "arranged" ? "Your introduction to the buyer is being arranged." : `Introduction request declined.${note ? ` ${note}` : ""}`)
    : (status === "arranged" ? "Your tender interest was passed to the buyer." : "Your tender interest wasn't taken further."), actor.userId);
  return { message: status === "arranged" ? "Marked as arranged" : "Marked as declined" };
}
