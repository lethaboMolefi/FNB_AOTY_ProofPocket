// Payment requests and proofs of payment: v2/app.js popChecks, popok/popno, reqpaid. ProofPocket never moves money.
import { PAYMENT_REQUEST_DAYS, RAILS, type PaymentStatus, type Rail } from "../constants";
import { addDays } from "../dates";
import { R } from "../format";

export interface ProofCheck { code: "amount" | "reference" | "date" | "reused" | "method"; ok: boolean; text: string }

export interface RequestForCheck { ref: string; amount: number; requestedOn: string; rails: Rail[] }
export interface ProofForCheck { amount: number; usedReference: boolean; paidOn: string; method: Rail }

/** The five checks shown to the founder. `fileUsedBefore` comes from a SHA-256 lookup across all businesses. */
export function proofChecks(q: RequestForCheck, p: ProofForCheck, fileUsedBefore: boolean): ProofCheck[] {
  const amountOk = Number(p.amount) === Number(q.amount);
  return [
    { code: "amount", ok: amountOk, text: amountOk ? `Amount matches (${R(q.amount)})` : `Amount on proof is ${R(p.amount)}, request is ${R(q.amount)}` },
    { code: "reference", ok: p.usedReference, text: p.usedReference ? `Client says they used reference ${q.ref}` : "Client did not use the reference" },
    { code: "date", ok: p.paidOn >= q.requestedOn, text: p.paidOn >= q.requestedOn ? "Paid after the request was sent" : "Payment date is before the request was sent" },
    { code: "reused", ok: !fileUsedBefore, text: fileUsedBefore ? "This exact file was used as proof before" : "Proof file not used before" },
    { code: "method", ok: q.rails.includes(p.method), text: `Paid by ${RAILS[p.method]}` },
  ];
}

export const expiresOn = (requestedOn: string) => addDays(requestedOn, PAYMENT_REQUEST_DAYS);

/** Statuses in which a client may still pay or send proof. */
export const OPEN_STATUSES: PaymentStatus[] = ["waiting", "not_received"];

/** Waiting or not-received requests with no proof expire after 7 days (inventory 12.4). */
export const shouldExpire = (status: PaymentStatus, requestedOn: string, today: string) =>
  OPEN_STATUSES.includes(status) && today > expiresOn(requestedOn);

export const canSendProof = (status: PaymentStatus, rails: Rail[]) =>
  OPEN_STATUSES.includes(status) && rails.some((r) => r === "payshap" || r === "eft");

export const canCancel = (status: PaymentStatus) => OPEN_STATUSES.includes(status);

/**
 * After the founder says "Not received": the client may try again once; the second
 * rejection flags the request and raises a possible fake-proof warning.
 */
export function afterNotReceived(attempts: number): { status: PaymentStatus; attempts: number; raiseFraudWarning: boolean } {
  const next = attempts + 1;
  return next >= 2 ? { status: "flagged", attempts: next, raiseFraudWarning: true } : { status: "not_received", attempts: next, raiseFraudWarning: false };
}

/** Client-facing reference typed into the banking app, e.g. PP-4821. */
export const formatRef = (n: number) => `PP-${n}`;
export const REF_PATTERN = /^PP-\d{4,6}$/;
