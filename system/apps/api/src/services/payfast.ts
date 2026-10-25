/**
 * PayFast payment gateway integration.
 *
 * ProofPocket never holds or moves money. PayFast handles the card/EFT transaction
 * between the client and the founder. Once PayFast confirms via the ITN webhook,
 * we auto-book the entry and mark the request paid — exactly as if the founder had
 * manually confirmed a proof of payment.
 *
 * Security model:
 *  - The ITN notification is verified with PayFast's MD5 signature (sorted params
 *    + optional passphrase). This is the PayFast spec.
 *  - We also do a server-side HTTP POST back to PayFast's /eng/query/validate to
 *    confirm the ITN is genuine (prevents replays).
 *  - The `m_payment_id` we send is the payment-request UUID, so mapping back to
 *    the founder's record is unambiguous.
 */
import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { R, todayZA } from "@proofpocket/shared";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { companies, paymentRequests } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import { addEntry } from "./books";

// ---------------------------------------------------------------- config helpers

export function payfastEnabled(config: Config): boolean {
  return !!(config.PAYFAST_MERCHANT_ID && config.PAYFAST_MERCHANT_KEY);
}

export function payfastHost(config: Config): string {
  return config.PAYFAST_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za";
}

// ---------------------------------------------------------------- signature

/**
 * Build a PayFast MD5 signature from a key-value map.
 * Keys are sorted alphabetically, empty strings and the "signature" key are excluded.
 * If a passphrase is set it is appended last (PayFast spec).
 */
export function payfastSignature(params: Record<string, string>, passphrase?: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== "signature" && params[k] !== "")
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k]!).replace(/%20/g, "+")}`)
    .join("&");
  const str = passphrase ? `${sorted}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}` : sorted;
  return createHash("md5").update(str).digest("hex");
}

// ---------------------------------------------------------------- initiate payment

interface InitiateParams {
  requestId: string;
  ref: string;
  amount: number;
  description: string;
  buyerName: string;
  /** Where PayFast should POST the ITN (must be publicly reachable). */
  notifyUrl: string;
  /** Where to send the buyer after success / cancel. */
  returnUrl: string;
  cancelUrl: string;
}

/**
 * Build the form fields for a PayFast payment page redirect.
 * The caller returns these as JSON; the browser then does a form POST to PayFast.
 */
export function buildPayfastForm(
  config: Config,
  p: InitiateParams,
): { host: string; fields: Record<string, string> } {
  if (!payfastEnabled(config)) throw new AppError(503, "payfast_disabled", "PayFast is not configured.");

  // Split buyer name into first / last (PayFast requires separate fields).
  const parts = p.buyerName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;

  const fields: Record<string, string> = {
    merchant_id: config.PAYFAST_MERCHANT_ID!,
    merchant_key: config.PAYFAST_MERCHANT_KEY!,
    return_url: p.returnUrl,
    cancel_url: p.cancelUrl,
    notify_url: p.notifyUrl,
    name_first: firstName,
    name_last: lastName,
    m_payment_id: p.requestId,
    amount: p.amount.toFixed(2),
    item_name: (p.description || `Payment ${p.ref}`).slice(0, 100),
    item_description: p.ref,
    custom_str1: p.ref,
  };

  fields.signature = payfastSignature(fields, config.PAYFAST_PASSPHRASE);
  return { host: payfastHost(config), fields };
}

// ---------------------------------------------------------------- ITN verification

export interface ItnPayload {
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: string;
  item_name: string;
  custom_str1: string;
  amount_gross: string;
  signature: string;
  [key: string]: string;
}

/**
 * Validate a PayFast ITN:
 *  1. Signature matches
 *  2. PayFast status is COMPLETE
 *  3. Server-side validation call back to PayFast returns "VALID"
 *
 * Returns the validated gross amount as a number, or throws.
 */
export async function validateItn(
  config: Config,
  payload: ItnPayload,
  rawBody: string,
): Promise<number> {
  if (!payfastEnabled(config)) throw new AppError(503, "payfast_disabled", "PayFast is not configured.");

  // 1. Signature check
  const expected = payfastSignature(payload, config.PAYFAST_PASSPHRASE);
  if (expected !== payload.signature) {
    throw new AppError(400, "itn_bad_signature", "ITN signature mismatch.");
  }

  // 2. Payment status — only COMPLETE means money moved.
  if (payload.payment_status !== "COMPLETE") {
    // Not an error; we just acknowledge and ignore (e.g. FAILED, CANCELLED).
    throw new AppError(200, "itn_not_complete", `Payment status: ${payload.payment_status}`);
  }

  // 3. Server-side validation. PayFast's sandbox can't reach localhost, so in sandbox
  //    mode we trust the signature alone for local development.
  if (!config.PAYFAST_SANDBOX) {
    try {
      const resp = await fetch(`https://${payfastHost(config)}/eng/query/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: rawBody,
        signal: AbortSignal.timeout(8_000),
      });
      const text = await resp.text();
      if (!text.includes("VALID")) {
        throw new AppError(400, "itn_invalid", "PayFast validation returned non-VALID.");
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(502, "itn_validate_failed", "Could not verify ITN with PayFast.");
    }
  }

  const amount = parseFloat(payload.amount_gross);
  if (!isFinite(amount) || amount <= 0) throw new AppError(400, "itn_bad_amount", "Invalid amount in ITN.");
  return amount;
}

// ---------------------------------------------------------------- auto-book on ITN

/**
 * Called after a validated COMPLETE ITN.
 * Finds the payment request, marks it paid, and auto-writes a ledger entry.
 */
export async function processItn(
  tx: Tx,
  config: Config,
  actor: Actor,
  payload: ItnPayload,
  grossAmount: number,
): Promise<{ ref: string; companyId: string }> {
  const requestId = payload.m_payment_id;

  const [r] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, requestId));
  if (!r) throw notFound("Payment request from ITN");

  // Idempotency: duplicate ITNs arrive sometimes — just return if already paid.
  if (r.status === "paid") return { ref: r.ref, companyId: r.companyId };

  if (!["waiting", "not_received"].includes(r.status)) {
    throw badRequest("not_open", `Cannot confirm payment: request is ${r.status}.`);
  }

  // Load the full company row (addEntry needs businessType etc.)
  const [company] = await tx.select().from(companies).where(eq(companies.id, r.companyId));
  if (!company) throw notFound("Company for this payment request");

  const today = todayZA();

  await addEntry(
    tx,
    actor,
    company,
    {
      clientUuid: randomUUID(),
      direction: "in",
      amount: grossAmount,
      method: "payfast",
      category: "Services",
      date: today,
      note: `${r.description || "Payment"} · ${r.clientName} · ${r.ref} · paid via PayFast (ref ${payload.pf_payment_id})`,
      isPersonal: false,
      confirmDuplicate: true,
    },
    { source: "payfast_itn", paymentRequestId: r.id },
  );

  await tx.update(paymentRequests)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(paymentRequests.id, r.id));

  await addActivity(
    tx,
    r.companyId,
    `${R(grossAmount)} received from ${r.clientName} via PayFast card payment (${r.ref}). Auto-confirmed.`,
    actor.userId,
  );

  await audit(tx, actor, {
    action: "payfast.itn_confirmed",
    entity: "payment_request",
    entityId: r.id,
    companyId: r.companyId,
    after: { pf_payment_id: payload.pf_payment_id, amount: grossAmount },
  });

  return { ref: r.ref, companyId: r.companyId };
}
