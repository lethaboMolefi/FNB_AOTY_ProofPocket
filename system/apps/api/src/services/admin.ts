// Admin portal (new; brief 7.6): organisations and their people, reports, feature requests, flagged payments,
// the sender watch list, tenders, and introductions for companies without an incubator.
import { addDays, R, todayZA, type DocType } from "@proofpocket/shared";
import { desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, introRequests, organisations, paymentRequests, posts, reports, senderWatchlist, tenderInterests, tenderRequirements, tenders, users } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";

export async function organisationsView(tx: Tx) {
  const orgs = await tx.select().from(organisations).orderBy(organisations.type, organisations.name);
  const people = await tx.select({ id: users.id, email: users.email, name: users.displayName, role: users.role, orgId: users.orgId, isLead: users.isLead }).from(users).orderBy(users.displayName);
  return {
    organisations: orgs.map((o) => ({ id: o.id, type: o.type, name: o.name, kind: o.kind, verified: o.verified, setupDone: o.setupDone, wants: o.wants, sectors: o.sectors, example: o.isExample, people: people.filter((p) => p.orgId === o.id) })),
    staff: people.filter((p) => p.role === "admin"),
  };
}

export async function createOrganisation(tx: Tx, actor: Actor, o: { type: "funder" | "incubator" | "buyer"; name: string; kind: string; wants: string; sectors: string[]; verified: boolean }) {
  const [row] = await tx.insert(organisations).values({ ...o, kind: o.kind || null, wants: o.wants || null, setupDone: o.type !== "funder" }).returning();
  await audit(tx, actor, { action: "organisation.created", entity: "organisation", entityId: row!.id, after: o });
  return { id: row!.id, message: `${o.name} added` };
}

export async function setVerified(tx: Tx, actor: Actor, id: string, verified: boolean) {
  const [o] = await tx.update(organisations).set({ verified }).where(eq(organisations.id, id)).returning();
  if (!o) throw notFound("That organisation");
  await audit(tx, actor, { action: verified ? "organisation.verified" : "organisation.unverified", entity: "organisation", entityId: id });
  return { message: verified ? `${o.name} is verified and shows the badge` : `${o.name} is no longer verified` };
}

/** Adds the person; the route creates their sign-in and emails them. */
export async function inviteUser(tx: Tx, actor: Actor, u: { orgId: string; email: string; displayName: string; isLead: boolean }) {
  const [o] = await tx.select().from(organisations).where(eq(organisations.id, u.orgId));
  if (!o) throw notFound("That organisation");
  const role = o.type === "funder" ? "funder" : o.type === "incubator" ? "adviser" : "buyer";
  const [exists] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${u.email}`);
  if (exists) throw badRequest("email_taken", "Someone with this email already has a ProofPocket account.");
  await tx.insert(users).values({ email: u.email, displayName: u.displayName, role, orgId: o.id, isLead: u.isLead && role === "adviser" });
  await audit(tx, actor, { action: "user.invited", entity: "organisation", entityId: o.id, after: { email: u.email, role } });
  return { orgName: o.name, role };
}

export async function reportsView(tx: Tx) {
  const rows = await tx.select({ r: reports, company: companies.name }).from(reports).leftJoin(companies, eq(companies.id, reports.companyId)).orderBy(desc(reports.createdAt));
  return rows.map(({ r, company }) => ({ id: r.id, target: r.targetType, company, reason: r.reason, status: r.status, note: r.resolutionNote, date: r.createdAt }));
}

export async function decideReport(tx: Tx, actor: Actor, id: string, status: "resolved" | "dismissed", note: string) {
  const [r] = await tx.update(reports).set({ status, resolvedBy: actor.userId, resolutionNote: note }).where(eq(reports.id, id)).returning();
  if (!r) throw notFound("That report");
  await audit(tx, actor, { action: `report.${status}`, entity: "report", entityId: id, companyId: r.companyId, after: { note } });
  return { message: status === "resolved" ? "Report resolved" : "Report dismissed" };
}

export async function featureRequests(tx: Tx) {
  const rows = await tx.select({ p: posts, company: companies.name, verifiedAt: companies.verifiedAt }).from(posts).innerJoin(companies, eq(companies.id, posts.companyId))
    .where(inArray(posts.feature, ["requested", "featured"])).orderBy(desc(posts.postedOn));
  return rows.map(({ p, company, verifiedAt }) => ({ id: p.id, company, verified: verifiedAt !== null, text: p.text, date: p.postedOn, feature: p.feature, featuredUntil: p.featuredUntil }));
}

export async function decideFeature(tx: Tx, actor: Actor, id: string, approve: boolean, note: string) {
  const [p] = await tx.select().from(posts).where(eq(posts.id, id));
  if (!p) throw notFound("That post");
  await tx.update(posts).set({ feature: approve ? "featured" : "rejected", featuredUntil: approve ? addDays(todayZA(), 7) : null, reviewNote: note || null, reviewedBy: actor.userId, reviewedAt: new Date() }).where(eq(posts.id, id));
  await addActivity(tx, p.companyId, approve ? "Your post is featured in the directory this week." : `Your feature request wasn't approved.${note ? ` ${note}` : ""}`, actor.userId);
  await audit(tx, actor, { action: approve ? "post.featured" : "post.feature_rejected", entity: "post", entityId: id, companyId: p.companyId, after: { note } });
  return { message: approve ? "Featured for 7 days" : "Feature request rejected" };
}

export async function flaggedPayments(tx: Tx) {
  const rows = await tx.select({ r: paymentRequests, company: companies.name }).from(paymentRequests).innerJoin(companies, eq(companies.id, paymentRequests.companyId))
    .where(eq(paymentRequests.status, "flagged")).orderBy(desc(paymentRequests.updatedAt));
  const watch = await tx.select().from(senderWatchlist).orderBy(desc(senderWatchlist.lastReportedAt));
  return {
    payments: rows.map(({ r, company }) => ({ id: r.id, ref: r.ref, company, client: r.clientName, amount: Number(r.amount), label: R(Number(r.amount)), attempts: r.attempts, date: r.updatedAt })),
    watchlist: watch.map((w) => ({ id: w.id, sender: w.senderKey, reports: w.reports, status: w.status, last: w.lastReportedAt })),
  };
}

export async function decideWatch(tx: Tx, actor: Actor, id: string, status: "confirmed_scam" | "cleared") {
  const [w] = await tx.update(senderWatchlist).set({ status }).where(eq(senderWatchlist.id, id)).returning();
  if (!w) throw notFound("That sender");
  await audit(tx, actor, { action: `watchlist.${status}`, entity: "sender", entityId: id, after: { sender: w.senderKey } });
  return { message: status === "confirmed_scam" ? "Confirmed as a scam. Founders are warned." : "Cleared" };
}

export async function tendersView(tx: Tx) {
  const list = await tx.select().from(tenders).orderBy(desc(tenders.closesOn));
  const reqs = list.length ? await tx.select().from(tenderRequirements).where(inArray(tenderRequirements.tenderId, list.map((t) => t.id))) : [];
  const interests = await tx.select({ i: tenderInterests, company: companies.name, incubatorId: companies.incubatorId, title: tenders.title }).from(tenderInterests)
    .innerJoin(companies, eq(companies.id, tenderInterests.companyId)).innerJoin(tenders, eq(tenders.id, tenderInterests.tenderId));
  const intros = await tx.select({ i: introRequests, company: companies.name, buyer: organisations.name }).from(introRequests)
    .innerJoin(companies, eq(companies.id, introRequests.companyId)).innerJoin(organisations, eq(organisations.id, introRequests.buyerId))
    .where(isNull(companies.incubatorId));
  return {
    tenders: list.map((t) => ({ id: t.id, title: t.title, buyer: t.buyerName, value: Number(t.value), closesOn: t.closesOn, minMonths: t.minMonths, sectors: t.sectors,
      requiredDocs: reqs.filter((r) => r.tenderId === t.id).map((r) => r.docType), interested: interests.filter((x) => x.i.tenderId === t.id).length })),
    // Companies without an incubator: ProofPocket arranges these (advisers handle their own cohort).
    requests: [
      ...intros.map(({ i, company, buyer }) => ({ kind: "intro" as const, id: i.id, company, about: buyer, status: i.status })),
      ...interests.filter((x) => !x.incubatorId).map(({ i, company, title }) => ({ kind: "tender" as const, id: i.id, company, about: title, status: i.status })),
    ],
  };
}

export async function createTender(tx: Tx, actor: Actor, t: { title: string; buyerName: string; value: number; closesOn: string; minMonths: number; sectors: string[]; requiredDocs: DocType[] }) {
  if (t.closesOn < todayZA()) throw badRequest("closed", "The closing date has passed.");
  const [row] = await tx.insert(tenders).values({ title: t.title, buyerName: t.buyerName, value: t.value.toFixed(2), closesOn: t.closesOn, minMonths: t.minMonths, sectors: t.sectors }).returning();
  if (t.requiredDocs.length) await tx.insert(tenderRequirements).values([...new Set(t.requiredDocs)].map((docType) => ({ tenderId: row!.id, docType })));
  await audit(tx, actor, { action: "tender.created", entity: "tender", entityId: row!.id, after: t });
  return { message: "Tender published" };
}
