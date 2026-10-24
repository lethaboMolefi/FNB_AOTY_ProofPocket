// Fraud protection and privacy (v2/app.js vProtection, vPrivacy; inventory 12.2 and 12.12).
import { messageRiskFlags, senderKey } from "@proofpocket/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, incubatorMemberships, messages, organisations, senderWatchlist, users } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import type { CompanyRow } from "../repositories/companies";
import { documentsOf } from "./documents";

export async function messageList(tx: Tx, companyId: string) {
  const rows = await tx.select().from(messages).where(eq(messages.companyId, companyId)).orderBy(desc(messages.createdAt));
  return rows.map((m) => ({ id: m.id, sender: m.sender, address: m.senderAddress, verified: m.verifiedSender, body: m.body, flags: m.riskFlags, status: m.status, date: m.receivedOn, kind: m.kind }));
}

export async function fingerprints(tx: Tx, companyId: string) {
  const { latest } = await documentsOf(tx, companyId);
  return [...latest.values()].filter((d) => d.sha256 && d.status !== "rejected").map((d) => ({ docType: d.docType, fileName: d.fileName, sha256: d.sha256!, status: d.status }));
}

/** "Report and block" puts the sender on a watch list other founders are warned about; "It's genuine" closes it. */
export async function decideMessage(tx: Tx, actor: Actor, c: CompanyRow, id: string, action: "block" | "safe") {
  const [m] = await tx.select().from(messages).where(and(eq(messages.id, id), eq(messages.companyId, c.id)));
  if (!m) throw notFound("That message");
  if (m.verifiedSender) throw badRequest("verified", "Messages from verified organisations can't be blocked here. Tell your adviser.");
  await tx.update(messages).set({ status: action === "block" ? "blocked" : "safe" }).where(eq(messages.id, m.id));
  if (action === "block" && m.kind !== "client_flag") {
    const key = senderKey(m.senderAddress || m.sender);
    await tx.insert(senderWatchlist).values({ senderKey: key })
      .onConflictDoUpdate({ target: senderWatchlist.senderKey, set: { reports: sql`${senderWatchlist.reports} + 1`, lastReportedAt: new Date() } });
  }
  await addActivity(tx, c.id, action === "block" ? `Reported and blocked "${m.sender}".` : `Marked "${m.sender}" as genuine.`, actor.userId);
  return { message: action === "block" ? "Reported. Other founders will be warned about this sender." : "Marked as genuine" };
}

/** "Check a message": the founder pastes a WhatsApp, SMS or email they received about money (inventory 12.2). */
export async function checkMessage(tx: Tx, actor: Actor, c: CompanyRow, input: { sender: string; text: string }) {
  const key = senderKey(input.sender);
  const [watch] = await tx.select().from(senderWatchlist).where(eq(senderWatchlist.senderKey, key));
  const onWatchlist = !!watch && watch.status !== "cleared";
  const flags = messageRiskFlags({ text: input.text, verifiedSender: false, onWatchlist });
  const [m] = await tx.insert(messages).values({
    companyId: c.id, kind: "checked_by_founder", sender: input.sender, senderAddress: input.sender, verifiedSender: false,
    body: input.text, riskFlags: flags, status: flags.length ? "open" : "safe",
  }).returning();
  await addActivity(tx, c.id, `Checked a message from ${input.sender}: ${flags.length ? `${flags.length} warning sign${flags.length > 1 ? "s" : ""}` : "no warning signs"}.`, actor.userId);
  return { id: m!.id, flags, reports: onWatchlist ? watch!.reports : 0, confirmedScam: watch?.status === "confirmed_scam" };
}

// ---------------------------------------------------------------- privacy and incubator
export async function privacyView(tx: Tx, c: CompanyRow) {
  const incubators = await tx.select({ id: organisations.id, name: organisations.name }).from(organisations)
    .where(and(eq(organisations.type, "incubator"), eq(organisations.verified, true))).orderBy(organisations.name);
  const current = incubators.find((i) => i.id === c.incubatorId) ?? null;
  const adviser = c.adviserId ? (await tx.select({ name: users.displayName }).from(users).where(eq(users.id, c.adviserId)))[0]?.name ?? null : null;
  const [pending] = await tx.select({ incubatorId: incubatorMemberships.incubatorId }).from(incubatorMemberships)
    .where(and(eq(incubatorMemberships.companyId, c.id), eq(incubatorMemberships.status, "requested")));
  return {
    sharing: c.funderSharing, incubators, incubator: current, adviser,
    pendingRequest: pending ? incubators.find((i) => i.id === pending.incubatorId) ?? null : null,
  };
}

export async function setSharing(tx: Tx, actor: Actor, c: CompanyRow, sharing: "none" | "summary" | "full") {
  await tx.update(companies).set({ funderSharing: sharing }).where(eq(companies.id, c.id));
  await addActivity(tx, c.id, `Funder sharing set to "${sharing}".`, actor.userId);
  await audit(tx, actor, { action: "sharing.changed", entity: "company", entityId: c.id, companyId: c.id, before: { sharing: c.funderSharing }, after: { sharing } });
  return { message: "Sharing updated" };
}

/** Ask to join an incubator (it must accept), or leave the current one (null). */
export async function requestIncubator(tx: Tx, actor: Actor, c: CompanyRow, incubatorId: string | null) {
  if (incubatorId === null) {
    if (!c.incubatorId) return { message: "You aren't with an incubator." };
    await tx.update(companies).set({ incubatorId: null }).where(eq(companies.id, c.id));
    await tx.update(incubatorMemberships).set({ status: "left", decidedAt: new Date() }).where(and(eq(incubatorMemberships.companyId, c.id), eq(incubatorMemberships.status, "active")));
    await addActivity(tx, c.id, "Left the incubator.", actor.userId);
    await audit(tx, actor, { action: "incubator.left", entity: "company", entityId: c.id, companyId: c.id, before: { incubatorId: c.incubatorId } });
    return { message: "You've left the incubator. Your adviser can no longer see your records." };
  }
  if (incubatorId === c.incubatorId) return { message: "You're already with this incubator." };
  const [org] = await tx.select().from(organisations).where(and(eq(organisations.id, incubatorId), eq(organisations.type, "incubator"), eq(organisations.verified, true)));
  if (!org) throw badRequest("unknown_incubator", "Choose an incubator from the list.");
  await tx.update(incubatorMemberships).set({ status: "declined", decidedAt: new Date() })
    .where(and(eq(incubatorMemberships.companyId, c.id), inArray(incubatorMemberships.status, ["requested"])));
  await tx.insert(incubatorMemberships).values({ companyId: c.id, incubatorId, status: "requested" });
  await addActivity(tx, c.id, `Asked to join ${org.name}.`, actor.userId);
  return { message: `Request sent. ${org.name} will accept you, and can then see your records to help.` };
}
