// Getting paid (v2/app.js vPayments, payPageHTML, popok/popno, reqpaid, supplierpay, cashout).
// ProofPocket never holds or moves money: it records payments and checks proofs.
import { randomInt, randomUUID } from "node:crypto";
import {
  afterNotReceived, canCancel, canSendProof, cashPayoutCategory, expiresOn, maskBank, OPEN_STATUSES, proofChecks, R, RAILS,
  shouldExpire, todayZA, type PaymentStatus, type ProofCheck, type Rail,
} from "@proofpocket/shared";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { companies, ledgerEntries, messages, paymentDetails, paymentProofs, paymentRequests, profiles, supplierBankChanges, suppliers, users } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { decryptField, encryptField, last4, randomToken } from "../lib/crypto";
import { AppError, badRequest, notFound } from "../lib/errors";
import type { CompanyRow } from "../repositories/companies";
import { addEntry } from "./books";
import { requireRegisteredFile, shaSeenElsewhere } from "./files";

type RequestRow = typeof paymentRequests.$inferSelect;
const money = (n: number) => n.toFixed(2);

export const payLink = (config: Config, r: Pick<RequestRow, "ref" | "publicToken">) => `${config.PUBLIC_WEB_URL}/pay/${r.ref}-${r.publicToken}`;

/** Expired requests are shown as expired straight away; the daily job also stores it. */
const effectiveStatus = (r: RequestRow, today = todayZA()): PaymentStatus =>
  shouldExpire(r.status, r.requestedOn, today) ? "expired" : r.status;

// ---------------------------------------------------------------- requests (founder)
export async function createRequest(tx: Tx, actor: Actor, c: CompanyRow, q: { client: string; amount: number; what: string; rails: Rail[] }) {
  const today = todayZA();
  for (let attempt = 0; attempt < 8; attempt++) {
    // PP- plus 4 digits, as in the prototype; 5 digits once 4 get crowded.
    const ref = `PP-${attempt < 5 ? randomInt(1000, 10000) : randomInt(10000, 100000)}`;
    try {
      const row = await tx.transaction(async (sp) => (await sp.insert(paymentRequests).values({
        companyId: c.id, ref, publicToken: randomToken(), clientName: q.client, amount: money(q.amount), description: q.what,
        rails: [...new Set(q.rails)], requestedOn: today, expiresAt: new Date(`${expiresOn(today)}T23:59:59+02:00`), createdBy: actor.userId,
      }).returning())[0]!);
      await addActivity(tx, c.id, `Payment request ${ref} created for ${q.client}.`, actor.userId);
      return row;
    } catch (e) {
      if ((e as { cause?: { code?: string } }).cause?.code !== "23505") throw e;
    }
  }
  throw new AppError(500, "ref_clash", "Couldn't create a reference. Try again.");
}

export async function listRequests(tx: Tx, config: Config, companyId: string) {
  const today = todayZA();
  const rows = await tx.select().from(paymentRequests).where(eq(paymentRequests.companyId, companyId)).orderBy(desc(paymentRequests.createdAt));
  // Store expiries the founder can see (the daily job does the rest).
  const expired = rows.filter((r) => effectiveStatus(r, today) === "expired" && r.status !== "expired").map((r) => r.id);
  if (expired.length) await tx.update(paymentRequests).set({ status: "expired" }).where(inArray(paymentRequests.id, expired));
  const proofs = rows.length ? await tx.select().from(paymentProofs).where(inArray(paymentProofs.paymentRequestId, rows.map((r) => r.id))).orderBy(desc(paymentProofs.createdAt)) : [];
  return rows.map((r) => {
    const latest = proofs.find((p) => p.paymentRequestId === r.id);
    return {
      id: r.id, ref: r.ref, client: r.clientName, amount: Number(r.amount), what: r.description, rails: r.rails, status: effectiveStatus(r, today),
      attempts: r.attempts, requestedOn: r.requestedOn, expiresOn: expiresOn(r.requestedOn), link: payLink(config, r),
      proof: latest && latest.status === "submitted" && r.status === "checking" ? {
        id: latest.id, payer: latest.payerName, amount: Number(latest.amount), paidOn: latest.paidOn, method: latest.method,
        usedReference: latest.usedReference, fileId: latest.fileId, checks: latest.checkResults as ProofCheck[], sentAt: latest.createdAt,
      } : null,
    };
  });
}

async function ownRequest(tx: Tx, c: CompanyRow, id: string) {
  const [r] = await tx.select().from(paymentRequests).where(and(eq(paymentRequests.id, id), eq(paymentRequests.companyId, c.id)));
  if (!r) throw notFound("That payment request");
  return r;
}

export async function cancelRequest(tx: Tx, actor: Actor, c: CompanyRow, id: string) {
  const r = await ownRequest(tx, c, id);
  if (!canCancel(effectiveStatus(r))) throw badRequest("not_open", "Only open requests can be cancelled.");
  await tx.update(paymentRequests).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(paymentRequests.id, id));
  await addActivity(tx, c.id, `Payment request ${r.ref} cancelled.`, actor.userId);
  return { message: `${r.ref} cancelled. The link no longer works.` };
}

/** "Paid me cash" (v2: reqpaid). */
export async function markCash(tx: Tx, actor: Actor, c: CompanyRow, id: string) {
  const r = await ownRequest(tx, c, id);
  if (!r.rails.includes("cash")) throw badRequest("no_cash", "This request doesn't allow cash.");
  // Cash can settle an open request, or one whose link has expired.
  if (![...OPEN_STATUSES, "expired"].includes(effectiveStatus(r))) throw badRequest("not_open", "This request is already settled.");
  await addEntry(tx, actor, c, {
    clientUuid: randomUUID(), direction: "in", amount: Number(r.amount), method: "cash", category: "Services", date: todayZA(),
    note: `${r.description || "Payment"} · ${r.clientName} · ${r.ref}`, isPersonal: false, confirmDuplicate: true,
  }, { source: "cash_request", paymentRequestId: r.id });
  await tx.update(paymentRequests).set({ status: "paid", paidAt: new Date() }).where(eq(paymentRequests.id, r.id));
  await addActivity(tx, c.id, `Payment ${r.ref} received (${R(Number(r.amount))}, Cash).`, actor.userId);
  return { message: "Payment added to your books" };
}

// ---------------------------------------------------------------- proofs (founder decides in their own bank)
async function proofWithRequest(tx: Tx, c: CompanyRow, proofId: string) {
  const [p] = await tx.select().from(paymentProofs).where(and(eq(paymentProofs.id, proofId), eq(paymentProofs.companyId, c.id)));
  if (!p) throw notFound("That proof of payment");
  const r = await ownRequest(tx, c, p.paymentRequestId);
  if (p.status !== "submitted" || r.status !== "checking") throw new AppError(409, "already_decided", "This proof has already been dealt with.");
  return { p, r };
}

/** Only "The money is in my account" records money in, with the proof attached. */
export async function confirmProof(tx: Tx, actor: Actor, c: CompanyRow, proofId: string) {
  const { p, r } = await proofWithRequest(tx, c, proofId);
  const { entry } = await addEntry(tx, actor, c, {
    clientUuid: randomUUID(), direction: "in", amount: Number(p.amount), method: p.method, category: "Services",
    date: p.paidOn > todayZA() ? todayZA() : p.paidOn, note: `${r.description || "Payment"} · ${r.clientName} · ${r.ref} · proof of payment attached`,
    isPersonal: false, confirmDuplicate: true,
  }, { source: "proof", paymentRequestId: r.id, paymentProofId: p.id });
  await tx.update(ledgerEntries).set({ receiptFileId: p.fileId, receiptKept: true }).where(eq(ledgerEntries.id, entry.id));
  await tx.update(paymentProofs).set({ status: "confirmed", decidedBy: actor.userId, decidedAt: new Date() }).where(eq(paymentProofs.id, p.id));
  await tx.update(paymentRequests).set({ status: "paid", paidAt: new Date() }).where(eq(paymentRequests.id, r.id));
  await addActivity(tx, c.id, `Confirmed ${R(Number(p.amount))} from ${r.clientName} (${r.ref}) in the bank. Proof of payment attached.`, actor.userId);
  await audit(tx, actor, { action: "proof.confirmed", entity: "payment_proof", entityId: p.id, companyId: c.id });
  return { message: "Confirmed and added to your books with the proof attached" };
}

/** "Not received": the client may try once more; the second time flags the request (v2: popno). */
export async function rejectProof(tx: Tx, actor: Actor, c: CompanyRow, proofId: string) {
  const { p, r } = await proofWithRequest(tx, c, proofId);
  const next = afterNotReceived(r.attempts);
  await tx.update(paymentProofs).set({ status: "rejected", decidedBy: actor.userId, decidedAt: new Date() }).where(eq(paymentProofs.id, p.id));
  await tx.update(paymentRequests).set({ status: next.status, attempts: next.attempts }).where(eq(paymentRequests.id, r.id));
  await addActivity(tx, c.id, `Proof of payment for ${r.ref} rejected: money not in the account.`, actor.userId);
  if (next.raiseFraudWarning) {
    await tx.insert(messages).values({
      companyId: c.id, kind: "client_flag", sender: `${r.clientName} (client)`, senderAddress: `Payment request ${r.ref}`, verifiedSender: false,
      body: `Sent proof of payment twice for ${R(Number(r.amount))}, but the money never arrived.`,
      riskFlags: ["Possible fake proof of payment", "Don't hand over goods until the money shows in your bank"], paymentRequestId: r.id,
    });
  }
  await audit(tx, actor, { action: next.raiseFraudWarning ? "proof.rejected_flagged" : "proof.rejected", entity: "payment_proof", entityId: p.id, companyId: c.id });
  return { message: next.raiseFraudWarning ? "Marked not received. Flagged as a possible fake proof of payment." : "Marked not received. The client can upload proof again." };
}

// ---------------------------------------------------------------- payment details
export async function currentDetails(tx: Tx, companyId: string) {
  const [d] = await tx.select().from(paymentDetails).where(eq(paymentDetails.companyId, companyId)).orderBy(desc(paymentDetails.createdAt)).limit(1);
  return d ?? null;
}

export const detailsView = (d: typeof paymentDetails.$inferSelect | null) => d && ({
  bank: d.bank, accountName: d.accountName, accountMasked: d.accountLast4 ? `••${d.accountLast4}` : "", shapId: d.shapId, inBusinessName: d.inBusinessName,
  changedAt: d.createdAt,
});

/** Saved after a Google Authenticator code (checked by the route). The adviser is told. */
export async function saveDetails(tx: Tx, actor: Actor, config: Config, c: CompanyRow, d: { bank: string; accountName: string; accountNumber: string; shapId: string; inBusinessName: boolean }) {
  const digits = d.accountNumber.replace(/\D/g, "");
  await tx.insert(paymentDetails).values({
    companyId: c.id, bank: d.bank, accountName: d.accountName, accountNumberEnc: encryptField(digits, config.ACCOUNT_NUMBER_KEY),
    accountLast4: last4(digits), shapId: d.shapId, inBusinessName: d.inBusinessName, changedBy: actor.userId,
  });
  await addActivity(tx, c.id, "Payment details updated.", actor.userId);
  await audit(tx, actor, { action: "payment_details.changed", entity: "company", entityId: c.id, companyId: c.id, after: { bank: d.bank, last4: last4(digits) } });
  // Who to tell: the assigned adviser, or every adviser at the incubator.
  if (!c.incubatorId) return [];
  const advisers = await tx.select({ email: users.email }).from(users).where(c.adviserId ? eq(users.id, c.adviserId) : and(eq(users.orgId, c.incubatorId), eq(users.role, "adviser")));
  return advisers.map((a) => a.email);
}

// ---------------------------------------------------------------- suppliers, supplier payments, cash payouts
export async function listSuppliers(tx: Tx, companyId: string) {
  const rows = await tx.select().from(suppliers).where(eq(suppliers.companyId, companyId)).orderBy(suppliers.name);
  return rows.filter((s) => !s.archivedAt).map((s) => ({ id: s.id, name: s.name, bank: s.bankMasked, pending: s.pendingBankMasked ? { bank: s.pendingBankMasked, since: s.pendingSince } : null }));
}

export async function addSupplier(tx: Tx, actor: Actor, c: CompanyRow, s: { name: string; bank: string; accountNumber: string }) {
  await tx.insert(suppliers).values({ companyId: c.id, name: s.name, bankMasked: maskBank(s.bank, s.accountNumber) });
  await addActivity(tx, c.id, `Supplier ${s.name} saved.`, actor.userId);
  return { message: "Supplier saved" };
}

async function ownSupplier(tx: Tx, c: CompanyRow, id: string) {
  const [s] = await tx.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, c.id)));
  if (!s || s.archivedAt) throw notFound("That supplier");
  return s;
}

/** New bank details for a supplier go on hold until confirmed by phone (replaces v2's "Simulate a change request"). */
export async function changeSupplierBank(tx: Tx, actor: Actor, c: CompanyRow, id: string, b: { bank: string; accountNumber: string }) {
  const s = await ownSupplier(tx, c, id);
  const to = maskBank(b.bank, b.accountNumber);
  await tx.update(suppliers).set({ pendingBankMasked: to, pendingSince: todayZA() }).where(eq(suppliers.id, s.id));
  await tx.insert(supplierBankChanges).values({ companyId: c.id, supplierId: s.id, fromMasked: s.bankMasked, toMasked: to, requestedBy: actor.userId });
  await addActivity(tx, c.id, `${s.name} sent new bank details. Payments on hold.`, actor.userId);
  return { message: "Change received. Payments to this supplier are on hold." };
}

export async function decideSupplierChange(tx: Tx, actor: Actor, c: CompanyRow, id: string, confirm: boolean) {
  const s = await ownSupplier(tx, c, id);
  if (!s.pendingBankMasked) throw badRequest("no_change", "There's no change waiting for this supplier.");
  await tx.update(suppliers).set(confirm ? { bankMasked: s.pendingBankMasked, pendingBankMasked: null, pendingSince: null } : { pendingBankMasked: null, pendingSince: null }).where(eq(suppliers.id, s.id));
  await tx.update(supplierBankChanges).set({ status: confirm ? "confirmed" : "rejected", decidedBy: actor.userId, decidedAt: new Date() })
    .where(and(eq(supplierBankChanges.supplierId, s.id), eq(supplierBankChanges.status, "pending")));
  await addActivity(tx, c.id, confirm ? `Confirmed ${s.name}'s new bank details by phone.` : `Rejected a bank detail change for ${s.name}.`, actor.userId);
  await audit(tx, actor, { action: confirm ? "supplier_bank.confirmed" : "supplier_bank.rejected", entity: "supplier", entityId: s.id, companyId: c.id, after: { to: s.pendingBankMasked } });
  return { message: confirm ? "New details confirmed" : "Change rejected. Old details kept." };
}

/** Recorded after the founder paid in their own banking app. Blocked while the supplier's bank details are on hold. */
export async function recordSupplierPayment(tx: Tx, actor: Actor, c: CompanyRow, p: { clientUuid: string; supplierId: string; amount: number; what: string; date: string }) {
  const s = await ownSupplier(tx, c, p.supplierId);
  if (s.pendingBankMasked) throw new AppError(409, "supplier_on_hold", `Payment blocked: ${s.name}'s bank details changed. Confirm by phone under Fraud protection first.`);
  const { created } = await addEntry(tx, actor, c, {
    clientUuid: p.clientUuid, direction: "out", amount: p.amount, method: "eft", category: "Stock and materials", date: p.date,
    note: `${p.what || "Supplier payment"} · ${s.name}`, isPersonal: false, confirmDuplicate: true,
  }, { source: "supplier_payment", supplierId: s.id });
  if (created) await addActivity(tx, c.id, `Paid ${s.name} ${R(p.amount)} to ${s.bankMasked}.`, actor.userId);
  return { message: `Recorded your payment to ${s.name} (${s.bankMasked}).` };
}

export async function recordCashPayout(tx: Tx, actor: Actor, c: CompanyRow, p: { clientUuid: string; name: string; amount: number; what: string; noPhone: boolean; date: string }) {
  const [done] = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.clientUuid, p.clientUuid));
  if (done) return { message: done.slipNumber ? `Recorded. Give ${p.name} slip number ${done.slipNumber}.` : "Cash payment recorded", slip: done.slipNumber };
  const slip = p.noPhone ? `S${randomInt(10000, 100000)}` : null;
  await addEntry(tx, actor, c, {
    clientUuid: p.clientUuid, direction: "out", amount: p.amount, method: "cash", category: cashPayoutCategory(c.businessType), date: p.date,
    note: `${p.what || "Cash payment"} · ${p.name}${slip ? ` · slip ${slip}` : ""}`, isPersonal: false, confirmDuplicate: true,
  }, { source: "cash_payout", slipNumber: slip });
  await addActivity(tx, c.id, `Cash payment of ${R(p.amount)} to ${p.name} recorded.`, actor.userId);
  return { message: slip ? `Recorded. Give ${p.name} slip number ${slip}.` : "Cash payment recorded", slip };
}

// ---------------------------------------------------------------- the public payment page (no account)
export function parsePayRef(param: string) {
  const m = /^(PP-\d{4,6})-([A-Za-z0-9_-]{8,64})$/.exec(param);
  return m ? { ref: m[1]!, token: m[2]! } : null;
}

/** What a client sees: only the founder's saved details for the allowed methods. */
export async function payPageView(tx: Tx, config: Config, requestId: string) {
  const [r] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId));
  if (!r) throw notFound("This payment request");
  const [c] = await tx.select({ name: companies.name, verifiedAt: companies.verifiedAt, slug: companies.slug }).from(companies).where(eq(companies.id, r.companyId));
  const d = await currentDetails(tx, r.companyId);
  const [prof] = await tx.select({ whatsapp: profiles.whatsapp }).from(profiles).where(eq(profiles.companyId, r.companyId));
  const status = effectiveStatus(r);
  const ways: Record<string, unknown> = {};
  for (const rail of r.rails) {
    if (rail === "payshap" && d?.shapId) ways.payshap = { shapId: d.shapId };
    if (rail === "eft" && d?.accountNumberEnc) ways.eft = { bank: d.bank, accountName: d.accountName, accountNumber: decryptField(d.accountNumberEnc, config.ACCOUNT_NUMBER_KEY) };
    if (rail === "cash") ways.cash = true;
    if (rail === "card_machine") ways.card_machine = true;
  }
  return {
    business: { name: c!.name, verified: c!.verifiedAt !== null, slug: c!.slug, whatsapp: prof?.whatsapp ?? "" },
    ref: r.ref, client: r.clientName, amount: Number(r.amount), what: r.description, requestedOn: r.requestedOn, expiresOn: expiresOn(r.requestedOn),
    status, attempts: r.attempts, rails: r.rails.map((x) => ({ key: x, label: RAILS[x] })), ways, canSendProof: canSendProof(status, r.rails),
  };
}

export async function submitProof(tx: Tx, requestId: string, p: { payer: string; amount: number; paidOn: string; method: Rail; usedReference: boolean; fileId: string }) {
  const [r] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId));
  if (!r) throw notFound("This payment request");
  const status = effectiveStatus(r);
  if (status === "expired") throw badRequest("expired", "This request has expired. Ask the business for a new link.");
  if (!canSendProof(status, r.rails)) throw badRequest("not_open", "This request isn't waiting for a proof of payment.");
  if (p.paidOn > todayZA()) throw badRequest("future_date", "The payment date can't be in the future.");
  if (!r.rails.includes(p.method)) throw badRequest("method", "Choose one of the ways this business accepts.");
  const file = await requireRegisteredFile(tx, p.fileId, r.companyId, "proof");
  const checks = proofChecks({ ref: r.ref, amount: Number(r.amount), requestedOn: r.requestedOn, rails: r.rails }, p, await shaSeenElsewhere(tx, file.sha256!, file.id));
  await tx.insert(paymentProofs).values({
    companyId: r.companyId, paymentRequestId: r.id, payerName: p.payer, amount: money(p.amount), paidOn: p.paidOn, method: p.method,
    usedReference: p.usedReference, fileId: file.id, checkResults: checks,
  });
  await tx.update(paymentRequests).set({ status: "checking" }).where(eq(paymentRequests.id, r.id));
  await addActivity(tx, r.companyId, `${p.payer} uploaded proof of payment for ${r.ref} (${R(p.amount)}).`);
  return { companyId: r.companyId, ref: r.ref, message: "Proof sent to the business. They'll confirm once the money is in." };
}
