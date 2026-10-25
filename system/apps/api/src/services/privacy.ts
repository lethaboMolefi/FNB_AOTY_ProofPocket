// The founder's own data (POPIA s23 access, s24 correction and deletion): download everything, or ask ProofPocket
// to correct or delete it. Exports read through row-level security as the founder, so they hold only what the
// founder may already see.
import { DATA_REQUEST_DAYS, PRIVACY_NOTICE_VERSION, todayZA } from "@proofpocket/shared";
import { eq, inArray } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Tx } from "../db/client";
import * as t from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import type { CompanyRow } from "../repositories/companies";

type CompanyTable = PgTable & { companyId: AnyPgColumn };

/** Everything kept about one company, by section. Internal columns and secrets are left out. */
const SECTIONS: Record<string, CompanyTable> = {
  documents: t.documents, files: t.files, ledgerEntries: t.ledgerEntries, stockItems: t.stockItems, stockMovements: t.stockMovements,
  suppliers: t.suppliers, supplierBankChanges: t.supplierBankChanges, statementImports: t.statementImports, statementLines: t.statementLines,
  monthlyHistory: t.monthlyHistory, paymentDetails: t.paymentDetails, paymentRequests: t.paymentRequests, paymentProofs: t.paymentProofs,
  messages: t.messages, profile: t.profiles, posts: t.posts, applications: t.applications, tenderInterests: t.tenderInterests,
  introRequests: t.introRequests, incubatorMemberships: t.incubatorMemberships, activity: t.activity,
  founderIdentity: t.founderIdentity, coFounders: t.companyCofounders,
};
/** Storage paths aren't the founder's data, and encrypted account and ID numbers are left out. */
const HIDDEN = new Set(["bucketPath", "accountNumberEnc", "idNumberEnc", "isExample"]);
const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !HIDDEN.has(k))));

export async function exportMyData(tx: Tx, actor: Actor, c: CompanyRow) {
  const [me] = await tx.select({ email: t.users.email, displayName: t.users.displayName, role: t.users.role, createdAt: t.users.createdAt }).from(t.users).where(eq(t.users.id, c.ownerId));
  const out: Record<string, unknown> = { exportedOn: todayZA(), account: me, company: clean([c as unknown as Record<string, unknown>])[0] };
  for (const [name, table] of Object.entries(SECTIONS)) {
    out[name] = clean(await tx.select().from(table).where(eq(table.companyId, c.id)) as Record<string, unknown>[]);
  }
  const appIds = (out.applications as { id: string }[]).map((a) => a.id);
  out.offers = appIds.length ? clean(await tx.select().from(t.offers).where(inArray(t.offers.applicationId, appIds)) as Record<string, unknown>[]) : [];
  await audit(tx, actor, { action: "privacy.exported", entity: "company", entityId: c.id, companyId: c.id });
  return out;
}

export async function requestDataChange(tx: Tx, actor: Actor, c: CompanyRow, r: { kind: "correction" | "deletion"; details: string }) {
  const what = r.kind === "deletion" ? "Delete my data" : "Correct my data";
  await tx.insert(t.reports).values({
    targetType: "data_request", targetId: c.id, companyId: c.id, reporterUserId: actor.userId,
    reason: `${what}${r.details ? `: ${r.details}` : ""}`,
  });
  await addActivity(tx, c.id, `Asked ProofPocket to ${r.kind === "deletion" ? "delete" : "correct"} your data.`, actor.userId);
  await audit(tx, actor, { action: `privacy.${r.kind}_requested`, entity: "company", entityId: c.id, companyId: c.id });
  return { message: `Sent. ProofPocket will reply within ${DATA_REQUEST_DAYS} days.` };
}

/** The founder agrees to the current privacy notice (after it changed since they joined). */
export async function acceptPrivacyNotice(tx: Tx, actor: Actor, c: CompanyRow) {
  await tx.update(t.companies).set({ consentAt: new Date(), consentVersion: PRIVACY_NOTICE_VERSION }).where(eq(t.companies.id, c.id));
  await audit(tx, actor, { action: "privacy.notice_accepted", entity: "company", entityId: c.id, companyId: c.id, before: { version: c.consentVersion }, after: { version: PRIVACY_NOTICE_VERSION } });
  return { message: "Thanks. You've agreed to the updated privacy notice." };
}
