// Loads the example data into an empty, migrated database. Runs as the owner (bypasses RLS).
import { randomBytes, randomUUID } from "node:crypto";
import {
  DOC_TYPES, DOCS, addDays, expiresOn, firstOfMonth, isVerified, monthsEnding, proofChecks, slug, todayZA, type DocState,
} from "@proofpocket/shared";
import type { Db } from "../client";
import * as s from "../schema/index";
import { encryptField, last4, randomToken } from "../../lib/crypto";
import { APPLICATIONS, BUYERS, COMPANIES, FUNDERS, INCUBATORS, MESSAGES, PAYMENT_REQUESTS, POSTS, STATEMENT_LINES, TENDERS } from "./data";

export interface SeedOptions { today?: string; accountKey: string; adminEmail: string }

const fakeSha = () => randomBytes(32).toString("hex");
const money = (n: number) => n.toFixed(2);

export async function seed(db: Db, opts: SeedOptions) {
  const today = opts.today ?? todayZA();
  const daysAgo = (n: number) => addDays(today, -n);
  /** A timestamp on that day (10:00 SAST), so lists sort the way the prototype showed them. */
  const at = (n: number) => new Date(`${daysAgo(n)}T08:00:00Z`);
  /** The prototype's inMonth(): this month, `off` days back but never before the 1st. */
  const inMonth = (off: number) => `${today.slice(0, 8)}${String(Math.max(1, Number(today.slice(8)) - off)).padStart(2, "0")}`;
  const ex = { isExample: true } as const;

  await db.transaction(async (tx) => {
    // ------------------------------------------------------------ organisations and staff users
    const orgId = new Map<string, string>();
    const userId = new Map<string, string>();

    for (const n of INCUBATORS) {
      const [o] = await tx.insert(s.organisations).values({ type: "incubator", name: n.name, verified: true, setupDone: true, ...ex }).returning();
      orgId.set(n.key, o!.id);
      for (const [i, a] of n.advisers.entries()) {
        const [u] = await tx.insert(s.users).values({ email: a.email, displayName: a.name, role: "adviser", orgId: o!.id, isLead: i === 0, ...ex }).returning();
        userId.set(a.name, u!.id);
      }
    }
    const programmeId = new Map<string, string>();
    for (const f of FUNDERS) {
      const [o] = await tx.insert(s.organisations).values({ type: "funder", name: f.name, kind: f.kind, verified: true, setupDone: f.setup, ...ex }).returning();
      orgId.set(f.key, o!.id);
      const [u] = await tx.insert(s.users).values({ email: f.user.email, displayName: f.user.name, role: "funder", orgId: o!.id, isLead: true, ...ex }).returning();
      userId.set(f.key, u!.id);
      for (const p of f.programmes) {
        const [pr] = await tx.insert(s.programmes).values({
          funderId: o!.id, name: p.name, minAmount: money(p.min), maxAmount: money(p.max), budget: money(p.budget), committed: money(p.used),
          minMonths: p.minMonths, minScore: p.minScore, ...ex,
        }).returning();
        programmeId.set(p.key, pr!.id);
        await tx.insert(s.programmeRequirements).values(p.req.map((docType) => ({ programmeId: pr!.id, docType })));
      }
    }
    for (const b of BUYERS) {
      await tx.insert(s.organisations).values({ type: "buyer", name: b.name, kind: b.kind, wants: b.wants, sectors: b.sectors, verified: true, setupDone: true, ...ex });
    }
    await tx.insert(s.users).values({ email: opts.adminEmail, displayName: "ProofPocket checker", role: "admin", ...ex });

    // ------------------------------------------------------------ companies
    const companyId = new Map<string, string>();
    const history = monthsEnding(today, 6).slice(0, 5);

    for (const c of COMPANIES) {
      const [owner] = await tx.insert(s.users).values({ email: c.founder.email, displayName: c.founder.name, role: "founder", ...ex }).returning();
      const docStates = Object.fromEntries(DOC_TYPES.map((k) => [k, (c.docs[k] ?? "missing") as DocState])) as Record<(typeof DOC_TYPES)[number], DocState>;
      const incubator = orgId.get(c.incubator.key)!;
      const [co] = await tx.insert(s.companies).values({
        ownerId: owner!.id, name: c.name, legalName: c.legalName, slug: slug(c.name), businessType: c.businessType, sector: c.sector,
        town: c.town, province: c.province, area: c.area, cipcNumber: c.cipc, stage: c.stage, employees: c.employees, foundedYear: c.founded,
        openingBalance: money(c.opening), openingBalanceDate: firstOfMonth(today), funderSharing: c.sharing,
        verifiedAt: isVerified(docStates) ? at(45) : null,
        incubatorId: incubator, adviserId: c.incubator.adviser ? userId.get(c.incubator.adviser)! : null, supportStage: c.incubator.stage,
        createdAt: at(60), ...ex,
      }).returning();
      const cid = co!.id;
      companyId.set(c.key, cid);
      await tx.insert(s.incubatorMemberships).values({ companyId: cid, incubatorId: incubator, status: "active", decidedAt: at(60), ...ex });

      // Documents: one checked upload per non-missing type.
      for (const k of DOC_TYPES) {
        const st = docStates[k];
        if (st === "missing") continue;
        const [file] = await tx.insert(s.files).values({
          companyId: cid, purpose: "document", bucketPath: `example/${cid}/${k}-v1.pdf`, mime: "application/pdf", sizeBytes: 184_320,
          sha256: fakeSha(), originalName: `${slug(DOCS[k].name)}.pdf`, uploadedBy: owner!.id, registeredAt: at(50), ...ex,
        }).returning();
        await tx.insert(s.documents).values({
          companyId: cid, docType: k, status: st, fileId: file!.id, version: 1, uploadedBy: owner!.id,
          reviewedBy: st === "pending" ? null : c.incubator.adviser ? userId.get(c.incubator.adviser) : null,
          reviewedAt: st === "pending" ? null : at(45), expiresOn: st === "expired" ? daysAgo(10) : null, ...ex,
        });
      }

      // Books: earlier months as history, this month as entries.
      const hist = c.months.map(([i, o], idx) => ({ month: history[idx]! + "-01", i, o })).filter((m) => m.i + m.o > 0);
      if (hist.length) await tx.insert(s.monthlyHistory).values(hist.map((m) => ({ companyId: cid, month: m.month, moneyIn: money(m.i), moneyOut: money(m.o), ...ex })));
      if (c.ledger.length) {
        await tx.insert(s.ledgerEntries).values(c.ledger.map(([off, direction, amount, method, category, note, extra]) => ({
          companyId: cid, clientUuid: randomUUID(), entryDate: inMonth(off), direction, amount: money(amount), method, category, note,
          isPersonal: extra?.personal === true, receiptKept: method !== "cash", source: "seed" as const, createdBy: owner!.id,
          slipNumber: /slip (S\d{5})/.exec(note)?.[1] ?? null, ...ex,
        })));
      }
      for (const [name, unit, qty, reorder, cost] of c.stock) {
        const [item] = await tx.insert(s.stockItems).values({ companyId: cid, name, unit, reorderAt: money(reorder), cost: money(cost), ...ex }).returning();
        await tx.insert(s.stockMovements).values({ companyId: cid, stockItemId: item!.id, clientUuid: randomUUID(), delta: money(qty), reason: "opening", createdBy: owner!.id, ...ex });
      }
      for (const sup of c.suppliers) {
        const [row] = await tx.insert(s.suppliers).values({
          companyId: cid, name: sup.name, bankMasked: sup.bank, pendingBankMasked: sup.pending?.bank ?? null, pendingSince: sup.pending ? daysAgo(sup.pending.daysAgo) : null, ...ex,
        }).returning();
        if (sup.pending) await tx.insert(s.supplierBankChanges).values({ companyId: cid, supplierId: row!.id, fromMasked: sup.bank, toMasked: sup.pending.bank, status: "pending", requestedBy: owner!.id, createdAt: at(sup.pending.daysAgo), ...ex });
      }
      await tx.insert(s.profiles).values({ companyId: cid, ...c.profile, ...ex });
      await tx.insert(s.paymentDetails).values({
        companyId: cid, bank: c.pay.bank, accountName: c.pay.accountName, accountNumberEnc: encryptField(c.pay.accountNumber, opts.accountKey),
        accountLast4: last4(c.pay.accountNumber), shapId: c.profile.whatsapp, inBusinessName: c.pay.inBusinessName, changedBy: owner!.id, createdAt: at(30), ...ex,
      });
      for (const l of c.incubator.log) {
        await tx.insert(s.supportLogs).values({ companyId: cid, incubatorId: incubator, adviserId: c.incubator.adviser ? userId.get(c.incubator.adviser) : null, supportType: l.type, note: l.note, logDate: daysAgo(l.daysAgo), createdAt: at(l.daysAgo), ...ex });
      }
      for (const a of c.activity) await tx.insert(s.activity).values({ companyId: cid, text: a.text, occurredAt: at(a.daysAgo), ...ex });
    }

    // ------------------------------------------------------------ applications and offers (R50 000 → R40 000 → R28 000)
    for (const a of APPLICATIONS) {
      const [app] = await tx.insert(s.applications).values({
        companyId: companyId.get(a.company)!, programmeId: programmeId.get(a.programme)!, funderId: orgId.get(a.funder)!,
        requestedAmount: money(a.requested), status: a.status, statusReason: a.statusReason, appliedOn: daysAgo(a.daysAgo), createdAt: at(a.daysAgo), ...ex,
      }).returning();
      for (const [i, o] of a.offers.entries()) {
        await tx.insert(s.offers).values({
          applicationId: app!.id, amount: money(o.amount), reason: o.reason, offeredOn: daysAgo(o.daysAgo), createdAt: at(o.daysAgo),
          changedBy: i === 0 ? null : userId.get(a.funder)!, ...ex,
        });
      }
    }

    // ------------------------------------------------------------ tenders
    for (const t of TENDERS) {
      const [row] = await tx.insert(s.tenders).values({ title: t.title, buyerName: t.buyer, value: money(t.value), closesOn: addDays(today, t.closesIn), minMonths: t.months, sectors: t.sectors, ...ex }).returning();
      await tx.insert(s.tenderRequirements).values(t.req.map((docType) => ({ tenderId: row!.id, docType })));
    }

    // ------------------------------------------------------------ messages, payment requests, posts, statement lines
    for (const m of MESSAGES) {
      await tx.insert(s.messages).values({
        companyId: companyId.get(m.company)!, kind: m.kind, sender: m.sender, senderAddress: m.address, senderOrgId: "org" in m && m.org ? orgId.get(m.org)! : null,
        verifiedSender: m.verified, body: m.body, riskFlags: m.flags, receivedOn: daysAgo(m.daysAgo), createdAt: at(m.daysAgo), ...ex,
      });
    }
    for (const q of PAYMENT_REQUESTS) {
      const cid = companyId.get(q.company)!;
      const requestedOn = daysAgo(q.daysAgo);
      const [req] = await tx.insert(s.paymentRequests).values({
        companyId: cid, ref: q.ref, publicToken: randomToken(), clientName: q.client, amount: money(q.amount), description: q.what, rails: q.rails,
        status: q.proof ? "checking" : "waiting", requestedOn, expiresAt: new Date(`${expiresOn(requestedOn)}T21:59:59Z`), createdAt: at(q.daysAgo), ...ex,
      }).returning();
      if (q.proof) {
        const [file] = await tx.insert(s.files).values({
          companyId: cid, purpose: "proof", bucketPath: `example/${cid}/proofs/${q.ref}.jpg`, mime: "image/jpeg", sizeBytes: 96_000,
          sha256: fakeSha(), originalName: q.proof.file, registeredAt: at(q.proof.daysAgo), ...ex,
        }).returning();
        const paidOn = daysAgo(q.proof.daysAgo);
        const checks = proofChecks({ ref: q.ref, amount: q.amount, requestedOn, rails: q.rails }, { amount: q.proof.amount, usedReference: q.proof.usedRef, paidOn, method: q.proof.method }, false);
        await tx.insert(s.paymentProofs).values({
          companyId: cid, paymentRequestId: req!.id, payerName: q.proof.payer, amount: money(q.proof.amount), paidOn, method: q.proof.method,
          usedReference: q.proof.usedRef, fileId: file!.id, checkResults: checks, createdAt: at(q.proof.daysAgo), ...ex,
        });
      }
    }
    for (const p of POSTS) {
      await tx.insert(s.posts).values({
        companyId: companyId.get(p.company)!, text: p.text, postedOn: daysAgo(p.daysAgo), sharedTo: p.shared, feature: p.feature,
        featuredUntil: p.feature === "featured" ? addDays(today, 7) : null, createdAt: at(p.daysAgo), ...ex,
      });
    }
    for (const key of new Set(STATEMENT_LINES.map((l) => l.company))) {
      const lines = STATEMENT_LINES.filter((l) => l.company === key);
      const cid = companyId.get(key)!;
      const [imp] = await tx.insert(s.statementImports).values({ companyId: cid, bank: "FNB", format: "csv", lineCount: lines.length, ...ex }).returning();
      await tx.insert(s.statementLines).values(lines.map((l) => ({ companyId: cid, importId: imp!.id, lineDate: daysAgo(l.daysAgo), description: l.description, amount: money(l.amount), direction: l.direction, ...ex })));
    }
  });
}
