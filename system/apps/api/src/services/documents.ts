// Documents, the checker queues and the Starter → Verified transition (v2/app.js routeCheck, approveDoc, docreject).
import { becomesVerified, canUpload, checkerFor, DOCS, docStatesFrom, type DocStates, type DocType } from "@proofpocket/shared";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, documents, files, messages, organisations, supportLogs } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, notFound } from "../lib/errors";
import { incubatorName, type CompanyRow } from "../repositories/companies";
import { requireRegisteredFile } from "./files";

export async function documentsOf(tx: Tx, companyId: string) {
  const rows = await tx.select({
    id: documents.id, docType: documents.docType, version: documents.version, status: documents.status, expiresOn: documents.expiresOn,
    rejectReason: documents.rejectReason, createdAt: documents.createdAt, fileId: files.id, fileName: files.originalName, sha256: files.sha256,
  }).from(documents).leftJoin(files, eq(files.id, documents.fileId)).where(eq(documents.companyId, companyId)).orderBy(desc(documents.version));
  const states = docStatesFrom(rows.map((r) => ({ docType: r.docType, version: r.version, status: r.status })));
  // Latest upload per type.
  const latest = new Map<DocType, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.docType)) latest.set(r.docType, r);
  return { states, latest };
}

export const docStatesOf = async (tx: Tx, companyId: string): Promise<DocStates> => (await documentsOf(tx, companyId)).states;

/** Who checks this company's uploads, in the founder-facing wording. */
export async function checkerText(tx: Tx, c: Pick<CompanyRow, "incubatorId">) {
  const name = await incubatorName(tx, c.incubatorId);
  return checkerFor(c) === "adviser" && name ? { kind: "adviser" as const, name } : { kind: "admin" as const, name: "ProofPocket" };
}

export async function uploadDocument(tx: Tx, actor: Actor, c: CompanyRow, docType: DocType, fileId: string) {
  const file = await requireRegisteredFile(tx, fileId, c.id, "document");
  const { states, latest } = await documentsOf(tx, c.id);
  const state = states[docType];
  // While joining, a founder may replace an upload that hasn't been checked yet.
  if (!canUpload(state) && !(c.joinedAt === null && state === "pending")) {
    throw new AppError(409, "document_locked", state === "verified" ? `Your ${DOCS[docType].name} is already verified.` : `Your ${DOCS[docType].name} is being checked.`);
  }
  const version = (latest.get(docType)?.version ?? 0) + 1;
  const [doc] = await tx.insert(documents).values({ companyId: c.id, docType, status: "pending", fileId: file.id, version, uploadedBy: actor.userId }).returning();
  if (c.joinedAt) await addActivity(tx, c.id, `Uploaded ${DOCS[docType].name}.`, actor.userId);
  await audit(tx, actor, { action: "document.uploaded", entity: "document", entityId: doc!.id, companyId: c.id, after: { docType, version, sha256: file.sha256 } });
  const checker = await checkerText(tx, c);
  return {
    id: doc!.id, docType, version, sha256: file.sha256!, fileName: file.originalName,
    message: checker.kind === "adviser" ? `Uploaded. ${checker.name} will check it.` : "Uploaded. A ProofPocket checker will check it.",
  };
}

/** Pending uploads from joined companies. Advisers see their cohort (RLS); admin sees companies without an incubator. */
export async function reviewQueue(tx: Tx, scope: "adviser" | "admin") {
  const rows = await tx.select({
    id: documents.id, docType: documents.docType, version: documents.version, uploadedAt: documents.createdAt,
    companyId: companies.id, companyName: companies.name, cipcNumber: companies.cipcNumber, verifiedAt: companies.verifiedAt,
    fileId: files.id, fileName: files.originalName, sha256: files.sha256, mime: files.mime,
  }).from(documents)
    .innerJoin(companies, eq(companies.id, documents.companyId))
    .leftJoin(files, eq(files.id, documents.fileId))
    .where(and(eq(documents.status, "pending"), isNotNull(companies.joinedAt), scope === "admin" ? isNull(companies.incubatorId) : isNotNull(companies.incubatorId)))
    .orderBy(documents.createdAt);
  // Only the latest version of each document is waiting.
  const latestVersion = new Map<string, number>();
  if (rows.length) {
    const vs = await tx.select({ companyId: documents.companyId, docType: documents.docType, v: sql<number>`max(${documents.version})`.as("v") })
      .from(documents).where(inArray(documents.companyId, [...new Set(rows.map((r) => r.companyId))])).groupBy(documents.companyId, documents.docType);
    for (const v of vs) latestVersion.set(`${v.companyId}:${v.docType}`, Number(v.v));
  }
  return rows.filter((r) => latestVersion.get(`${r.companyId}:${r.docType}`) === r.version)
    .map((r) => ({ ...r, verified: r.verifiedAt !== null, docName: DOCS[r.docType].name }));
}

type Decision = { approve: true; expiresOn?: string | null } | { approve: false; reason: string };

export interface ReviewResult { companyId: string; companyName: string; docName: string; verifiedNow: boolean; rejected: boolean; reason?: string }

/** Approve or send back one upload. Advisers check their cohort; admin checks companies without an incubator. */
export async function reviewDocument(tx: Tx, actor: Actor & { displayName: string; orgId: string | null }, docId: string, scope: "adviser" | "admin", d: Decision): Promise<ReviewResult> {
  const [doc] = await tx.select().from(documents).where(eq(documents.id, docId));
  if (!doc) throw notFound("That document");
  const [c] = await tx.select().from(companies).where(eq(companies.id, doc.companyId));
  if (!c) throw notFound("That company");
  if ((scope === "admin") !== (c.incubatorId === null)) throw new AppError(403, "wrong_checker", scope === "admin" ? "This company's incubator checks its documents." : "A ProofPocket checker handles this company.");
  if (doc.status !== "pending") throw new AppError(409, "already_reviewed", "This document has already been checked.");
  const { states, latest } = await documentsOf(tx, c.id);
  if (latest.get(doc.docType)?.id !== doc.id) throw new AppError(409, "superseded", "A newer upload replaced this one.");
  const docName = DOCS[doc.docType].name;
  const checkerName = scope === "admin" ? "ProofPocket checker" : actor.displayName;
  const fromOrg = scope === "adviser" && actor.orgId
    ? (await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, actor.orgId)))[0]?.name ?? null
    : null;

  if (d.approve) {
    const verifiedNow = becomesVerified(states, doc.docType);
    await tx.update(documents).set({ status: "verified", reviewedBy: actor.userId, reviewedAt: new Date(), expiresOn: d.expiresOn ?? null }).where(eq(documents.id, doc.id));
    await addActivity(tx, c.id, `${docName} approved by ${checkerName}.`, actor.userId);
    if (scope === "adviser" && c.incubatorId) {
      await tx.insert(supportLogs).values({ companyId: c.id, incubatorId: c.incubatorId, adviserId: actor.userId, supportType: "Document check", note: `Approved ${docName}.` });
    }
    if (verifiedNow) {
      await tx.update(companies).set({ verifiedAt: new Date() }).where(eq(companies.id, c.id));
      await addActivity(tx, c.id, "Verified on ProofPocket. Listed in the public directory.");
      await tx.insert(messages).values({ companyId: c.id, kind: "system", sender: "ProofPocket", senderAddress: "Verified", verifiedSender: true, body: "You're verified. Funders, buyers and customers can now find you." });
    }
    await audit(tx, actor, { action: "document.approved", entity: "document", entityId: doc.id, companyId: c.id, after: { docType: doc.docType, expiresOn: d.expiresOn ?? null, verifiedNow } });
    return { companyId: c.id, companyName: c.name, docName, verifiedNow, rejected: false };
  }

  await tx.update(documents).set({ status: "rejected", reviewedBy: actor.userId, reviewedAt: new Date(), rejectReason: d.reason }).where(eq(documents.id, doc.id));
  await tx.insert(messages).values({
    companyId: c.id, kind: fromOrg ? "organisation" : "system", sender: fromOrg ?? "ProofPocket", senderAddress: fromOrg ? "Verified incubator" : "Verified",
    senderOrgId: fromOrg ? actor.orgId : null, verifiedSender: true, body: `Please upload your ${docName} again: ${d.reason}`,
  });
  await addActivity(tx, c.id, `${docName} sent back: ${d.reason}`, actor.userId);
  await audit(tx, actor, { action: "document.rejected", entity: "document", entityId: doc.id, companyId: c.id, after: { docType: doc.docType, reason: d.reason } });
  return { companyId: c.id, companyName: c.name, docName, verifiedNow: false, rejected: true, reason: d.reason };
}
