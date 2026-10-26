// Join wizard: Details → Documents → Join (v2/app.js vJoin, joinsubmit).
import { joinDocsFor, PRIVACY_NOTICE_VERSION, slug, todayZA, type JoinDetails } from "@proofpocket/shared";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, companyCofounders, founderIdentity, incubatorMemberships, organisations, profiles, users } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { encryptField } from "../lib/crypto";
import { AppError } from "../lib/errors";
import type { CompanyRow } from "../repositories/companies";
import { checkerText, docStatesOf } from "./documents";

async function verifiedIncubator(tx: Tx, id: string | null) {
  if (!id) return null;
  const [o] = await tx.select().from(organisations).where(and(eq(organisations.id, id), eq(organisations.type, "incubator"), eq(organisations.verified, true)));
  if (!o) throw new AppError(400, "unknown_incubator", "Choose an incubator from the list, or None yet.");
  return o;
}

const fields = (d: JoinDetails) => ({
  name: d.registered && d.legalName ? d.legalName : d.businessName,
  legalName: d.registered ? d.legalName || null : null,
  businessType: d.businessType, sector: d.sector, town: d.town, province: d.province, area: d.area,
  cipcNumber: d.registered ? d.cipcNumber! : null,
});

/** Inserts the company with a unique public slug (retries with a suffix on a clash, inside a savepoint). */
async function insertCompany(tx: Tx, values: typeof companies.$inferInsert) {
  const base = slug(values.name) || "business";
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    try {
      return await tx.transaction(async (sp) => (await sp.insert(companies).values({ ...values, slug: candidate }).returning())[0]!);
    } catch (e) {
      if ((e as { cause?: { code?: string } }).cause?.code !== "23505") throw e;
    }
  }
  throw new AppError(500, "slug_clash", "Couldn't save the business name. Try again.");
}

/**
 * Step 1. Creates the founder's account and an unfinished company (or updates it if they come back).
 * Called in the 'joining' database context; switches to the new founder for the company rows.
 */
export async function saveDetails(tx: Tx, who: { firebaseUid: string; email: string; existingUserId: string | null }, d: JoinDetails, key: string) {
  const incubator = await verifiedIncubator(tx, d.incubatorId);
  let userId = who.existingUserId;
  if (!userId) {
    const [u] = await tx.insert(users).values({ firebaseUid: who.firebaseUid, email: who.email, displayName: d.founderName, role: "founder" }).returning({ id: users.id });
    userId = u!.id;
  }
  // From here the database treats this request as the new founder.
  await tx.execute(sql`select set_config('app.role', 'founder', true), set_config('app.user_id', ${userId}, true)`);
  await tx.update(users).set({ displayName: d.founderName }).where(eq(users.id, userId));

  const [existing] = await tx.select().from(companies).where(eq(companies.ownerId, userId));
  if (existing?.joinedAt) throw new AppError(409, "already_joined", "You've already joined. Change your details in Business settings.");
  const today = todayZA();
  let c: CompanyRow;
  if (existing) {
    [c] = (await tx.update(companies).set({ ...fields(d), incubatorId: incubator?.id ?? null, supportStage: 0 }).where(eq(companies.id, existing.id)).returning()) as [CompanyRow];
    await tx.update(incubatorMemberships).set({ status: "left", decidedAt: new Date() }).where(and(eq(incubatorMemberships.companyId, c.id), eq(incubatorMemberships.status, "active")));
  } else {
    c = await insertCompany(tx, {
      ...fields(d), slug: "", ownerId: userId, incubatorId: incubator?.id ?? null,
      foundedYear: Number(today.slice(0, 4)), openingBalanceDate: today, funderSharing: "summary",
    });
    await tx.insert(profiles).values({ companyId: c.id });
  }
  if (incubator) await tx.insert(incubatorMemberships).values({ companyId: c.id, incubatorId: incubator.id, status: "active", decidedAt: new Date() });
  // ID numbers are encrypted here and never logged; only the owner and the admin can read these rows.
  const identity = { idNumberEnc: encryptField(d.idNumber, key), phone: d.phone };
  await tx.insert(founderIdentity).values({ companyId: c.id, ...identity }).onConflictDoUpdate({ target: founderIdentity.companyId, set: { ...identity, updatedAt: new Date() } });
  await tx.delete(companyCofounders).where(eq(companyCofounders.companyId, c.id));
  if (d.coFounders?.length) {
    await tx.insert(companyCofounders).values(d.coFounders.map((p) => ({
      companyId: c.id, fullName: p.fullName, idNumberEnc: encryptField(p.idNumber, key), role: p.role, email: p.email, phone: p.phone, shareholding: p.shareholding ?? null,
    })));
  }
  return { userId, company: c };
}

/** Step 3. Checks the documents are attached, records consent and sends them for checking. */
export async function completeJoin(tx: Tx, actor: Actor, c: CompanyRow, emailVerified: boolean) {
  if (c.joinedAt) throw new AppError(409, "already_joined", "You've already joined.");
  if (!emailVerified) throw new AppError(403, "verify_email", "Confirm your email address first: enter the 6-digit code we emailed you.");
  const registered = c.cipcNumber !== null;
  const states = await docStatesOf(tx, c.id);
  const missing = joinDocsFor(registered).filter((k) => states[k] !== "pending" && states[k] !== "verified");
  if (missing.length) throw new AppError(400, "documents_missing", "Attach every document before joining.");
  await tx.update(companies).set({ joinedAt: new Date(), consentAt: new Date(), consentVersion: PRIVACY_NOTICE_VERSION }).where(eq(companies.id, c.id));
  await addActivity(tx, c.id, `Joined ProofPocket${registered ? "; documents sent for checking" : " as a Starter"}.`, actor.userId);
  await audit(tx, actor, { action: "company.joined", entity: "company", entityId: c.id, companyId: c.id, after: { registered, consent: true, privacyNotice: PRIVACY_NOTICE_VERSION } });
  const checker = await checkerText(tx, c);
  return { message: checker.kind === "adviser" ? `Welcome! ${checker.name} will check your documents.` : "Welcome! A ProofPocket checker is reviewing your documents." };
}
