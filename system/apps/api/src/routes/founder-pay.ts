// Founder: Payments, Fraud protection, Privacy & sharing (phase 4).
import {
  cashPayoutSchema, checkMessageSchema, dataRequestSchema, incubatorRequestSchema, messageActionSchema, paymentDetailsSchema, paymentRequestSchema,
  sharingSchema, supplierBankSchema, supplierPaymentSchema, supplierSchema, todayZA,
} from "@proofpocket/shared";
import { Router, type Request } from "express";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { AppError, badRequest } from "../lib/errors";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { myCompany, type CompanyRow } from "../repositories/companies";
import {
  addSupplier, cancelRequest, changeSupplierBank, confirmProof, createRequest, currentDetails, decideSupplierChange, detailsView, listRequests,
  listSuppliers, markCash, payLink, recordCashPayout, recordSupplierPayment, rejectProof, saveDetails,
} from "../services/payments";
import { payfastEnabled } from "../services/payfast";
import { checkMessage, decideMessage, fingerprints, messageList, privacyView, requestIncubator, setSharing } from "../services/protection";
import { acceptPrivacyNotice, exportMyData, requestDataChange } from "../services/privacy";
import { checkCode, codeError } from "../services/two-factor";

export function founderPayRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);
  const asFounder = <T>(req: Request, fn: (tx: Tx, c: CompanyRow) => Promise<T>) =>
    withContext(deps.db, contextOf(req), async (tx) => fn(tx, await myCompany(tx, req.auth!.user!.id)));
  const id = (req: Request) => String(req.params.id);

  // ------------------------------------------------------------ Payments
  r.get("/founder/payments", founder, handle((req) => asFounder(req, async (tx, c) => ({
    requests: await listRequests(tx, deps.config, c.id),
    details: detailsView(await currentDetails(tx, c.id)),
    suppliers: await listSuppliers(tx, c.id),
    authenticatorOn: req.auth!.user!.totpEnabled,
    payfastEnabled: payfastEnabled(deps.config),
    businessType: c.businessType,
  }))));
  r.post("/founder/payment-requests", founder, handle((req) => {
    const q = parse(paymentRequestSchema, req.body);
    if (q.rails.includes("payfast") && !payfastEnabled(deps.config)) throw badRequest("payfast_off", "Card payments through PayFast aren't available yet. Choose another way to pay.");
    return asFounder(req, async (tx, c) => {
      const row = await createRequest(tx, actorOf(req), c, q);
      return { ref: row.ref, link: payLink(deps.config, row), message: `Request ${row.ref} created. Send the link on WhatsApp or show the QR code.` };
    });
  }));
  r.post("/founder/payment-requests/:id/cancel", founder, handle((req) => asFounder(req, (tx, c) => cancelRequest(tx, actorOf(req), c, id(req)))));
  r.post("/founder/payment-requests/:id/cash", founder, handle((req) => asFounder(req, (tx, c) => markCash(tx, actorOf(req), c, id(req)))));
  r.post("/founder/proofs/:id/confirm", founder, handle((req) => asFounder(req, (tx, c) => confirmProof(tx, actorOf(req), c, id(req)))));
  r.post("/founder/proofs/:id/reject", founder, handle((req) => asFounder(req, (tx, c) => rejectProof(tx, actorOf(req), c, id(req)))));

  /** Changing where clients pay needs a Google Authenticator code, so a stolen password isn't enough. */
  r.put("/founder/payment-details", limits.auth(), founder, handle(async (req) => {
    const d = parse(paymentDetailsSchema, req.body);
    const user = req.auth!.user!;
    if (!user.totpEnabled) throw new AppError(403, "authenticator_needed", "Set up Google Authenticator under Business settings first. It protects where clients pay you.");
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const res = await checkCode(tx, deps.config, user.id, d.code);
      if (res !== "ok") return { res, notify: [] as string[], company: "" };
      const c = await myCompany(tx, user.id);
      return { res, notify: await saveDetails(tx, actorOf(req), deps.config, c, d), company: c.name };
    });
    if (result.res !== "ok") throw codeError(result.res);
    await deps.mailer.send({ to: user.email, subject: "Your payment details changed", text: `The bank details ${result.company} shows clients on ProofPocket payment pages were changed. If this wasn't you, sign in and change them back, then contact your adviser.`, action: { label: "Check your payment details", url: `${deps.config.PUBLIC_WEB_URL}/app/payments` } });
    for (const to of result.notify) await deps.mailer.send({ to, subject: `${result.company} changed their payment details`, text: `${result.company} changed the bank details clients see on their ProofPocket payment pages. Check with the founder that they made this change.`, action: { label: "Open the adviser portal", url: `${deps.config.PUBLIC_WEB_URL}/adviser` } });
    return { message: "Payment details saved" };
  }));

  r.post("/founder/suppliers", founder, handle((req) => {
    const s = parse(supplierSchema, req.body);
    return asFounder(req, (tx, c) => addSupplier(tx, actorOf(req), c, s));
  }));
  r.put("/founder/suppliers/:id/bank", founder, handle((req) => {
    const b = parse(supplierBankSchema, req.body);
    return asFounder(req, (tx, c) => changeSupplierBank(tx, actorOf(req), c, id(req), b));
  }));
  r.post("/founder/suppliers/:id/confirm", founder, handle((req) => asFounder(req, (tx, c) => decideSupplierChange(tx, actorOf(req), c, id(req), true))));
  r.post("/founder/suppliers/:id/reject", founder, handle((req) => asFounder(req, (tx, c) => decideSupplierChange(tx, actorOf(req), c, id(req), false))));
  r.post("/founder/supplier-payments", founder, handle((req) => {
    const p = parse(supplierPaymentSchema, req.body);
    return asFounder(req, (tx, c) => recordSupplierPayment(tx, actorOf(req), c, p));
  }));
  r.post("/founder/cash-payouts", founder, handle((req) => {
    const p = parse(cashPayoutSchema, req.body);
    return asFounder(req, (tx, c) => recordCashPayout(tx, actorOf(req), c, p));
  }));

  // ------------------------------------------------------------ Fraud protection
  r.get("/founder/protection", founder, handle((req) => asFounder(req, async (tx, c) => ({
    messages: await messageList(tx, c.id), suppliers: await listSuppliers(tx, c.id), fingerprints: await fingerprints(tx, c.id),
  }))));
  r.post("/founder/messages/:id", founder, handle((req) => {
    const { action } = parse(messageActionSchema, req.body);
    return asFounder(req, (tx, c) => decideMessage(tx, actorOf(req), c, id(req), action));
  }));
  r.post("/founder/check-message", founder, handle((req) => {
    const m = parse(checkMessageSchema, req.body);
    return asFounder(req, (tx, c) => checkMessage(tx, actorOf(req), c, m));
  }));

  // ------------------------------------------------------------ Privacy & sharing
  r.get("/founder/privacy", founder, handle((req) => asFounder(req, (tx, c) => privacyView(tx, c))));
  r.put("/founder/privacy", founder, handle((req) => {
    const { sharing } = parse(sharingSchema, req.body);
    return asFounder(req, (tx, c) => setSharing(tx, actorOf(req), c, sharing));
  }));
  r.get("/founder/privacy/export", founder, handle(async (req, res) => {
    const data = await asFounder(req, (tx, c) => exportMyData(tx, actorOf(req), c));
    res.setHeader("Content-Disposition", `attachment; filename="proofpocket-my-data-${todayZA()}.json"`);
    res.setHeader("Cache-Control", "private, no-store");
    return data;
  }));
  r.post("/founder/privacy/consent", founder, handle((req) => asFounder(req, (tx, c) => acceptPrivacyNotice(tx, actorOf(req), c))));
  r.post("/founder/privacy/requests", founder, handle((req) => {
    const d = parse(dataRequestSchema, req.body);
    return asFounder(req, (tx, c) => requestDataChange(tx, actorOf(req), c, d));
  }));
  r.post("/founder/incubator", founder, handle((req) => {
    const { incubatorId } = parse(incubatorRequestSchema, req.body);
    return asFounder(req, (tx, c) => requestIncubator(tx, actorOf(req), c, incubatorId));
  }));

  return r;
}
