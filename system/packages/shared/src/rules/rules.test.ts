import { describe, expect, it } from "vitest";
import { DOC_TYPES } from "../constants";
import { R, Rc, shortDate, slug } from "../format";
import { duplicateWarning, findDuplicate, restockCost, restockQuantity, stockDelta, cashPayoutCategory } from "./bookkeeping";
import { cashflowSummary } from "./cashflow";
import { canApply, funderVisible, programmeGaps, tenderAction } from "./eligibility";
import { flags, byUrgency } from "./flags";
import { journey } from "./journey";
import { cashOnHand, lastEntryDays, monthTotals, recordMonths, series } from "./ledger";
import { afterNotReceived, canSendProof, proofChecks, shouldExpire } from "./payments";
import { nextSteps, readiness, scoreLabel } from "./readiness";
import { becomesVerified, canUpload, checkerFor, docStatesFrom, isVerified, joinDocsFor } from "./verification";
import { TODAY, mabele, mamaTau, nala, rekasi } from "./fixtures.test-helpers";

describe("format", () => {
  it("formats rand like the prototype", () => {
    expect(R(12450)).toBe("R12 450");
    expect(R(-300.4)).toBe("−R300");
    expect(R(0)).toBe("R0");
    // Unit prices keep their cents; whole amounts look the same as R().
    expect(Rc(45.5)).toBe("R45.50");
    expect(Rc(1234.05)).toBe("R1\u00a0234.05");
    expect(Rc(60)).toBe("R60");
  });
  it("short dates and slugs", () => {
    expect(shortDate("2026-10-12")).toBe("12 Oct");
    expect(slug("Nala Nails & Lashes")).toBe("nala-nails-lashes");
  });
});

describe("verification", () => {
  it("is verified only with CIPC, ID, bank and address", () => {
    expect(isVerified(nala().docs)).toBe(false);
    expect(isVerified(rekasi().docs)).toBe(true);
  });
  it("asks Starters for ID and address only", () => {
    expect(joinDocsFor(false)).toEqual(["id", "addr"]);
    expect(joinDocsFor(true)).toEqual(["cipc", "id", "bank", "addr"]);
  });
  it("routes checks to the adviser, or the admin checker without an incubator", () => {
    expect(checkerFor({ incubatorId: "x" })).toBe("adviser");
    expect(checkerFor({ incubatorId: null })).toBe("admin");
  });
  it("the fourth joining approval is the one that verifies", () => {
    const d = { ...nala().docs, cipc: "verified" as const, bank: "pending" as const };
    expect(becomesVerified(d, "bank")).toBe(true);
    expect(becomesVerified(nala().docs, "cipc")).toBe(false);
    expect(becomesVerified(rekasi().docs, "csd")).toBe(false);
  });
  it("uploads allowed only when missing or expired", () => {
    expect(["missing", "expired", "pending", "verified"].map((s) => canUpload(s as never))).toEqual([true, true, false, false]);
  });
  it("latest upload wins and a send-back reads as missing", () => {
    const d = docStatesFrom([
      { docType: "tax", version: 1, status: "verified" },
      { docType: "tax", version: 2, status: "rejected" },
      { docType: "id", version: 1, status: "pending" },
    ]);
    expect(d.tax).toBe("missing");
    expect(d.id).toBe("pending");
    expect(DOC_TYPES.filter((k) => d[k] === "missing")).toHaveLength(8);
  });
});

describe("ledger figures", () => {
  it("this month's totals and last entry", () => {
    expect(monthTotals(nala().entries, TODAY)).toEqual({ moneyIn: 1650, moneyOut: 1890, profit: -240 });
    expect(lastEntryDays(nala().entries, TODAY)).toBe(9);
    expect(lastEntryDays([], TODAY)).toBe(Infinity);
  });
  it("counts record months over the whole history, not capped at six", () => {
    expect(recordMonths(nala())).toBe(4);
    expect(recordMonths(rekasi())).toBe(6);
    const long = { ...mabele(), history: Array.from({ length: 12 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, "0")}`, moneyIn: 1, moneyOut: 1 })).concat(mabele().history) };
    expect(recordMonths(long)).toBe(18);
  });
  it("uses entries over history for the same month, so nothing is counted twice", () => {
    const s = { ...nala(), history: [...nala().history, { month: "2026-10", moneyIn: 99999, moneyOut: 0 }] };
    expect(series(s, TODAY)[5]).toMatchObject({ moneyIn: 1650, moneyOut: 1890, current: true, label: "Oct*" });
  });
  it("cash on hand = opening balance + entries since its date", () => {
    expect(cashOnHand(nala())).toBe(1400 - 240);
    expect(cashOnHand({ ...nala(), openingBalanceDate: "2026-10-14" })).toBe(1400 + 520 - 640 + 300);
  });
  it("ignores voided entries", () => {
    const s = nala();
    s.entries[0]!.voided = true;
    expect(monthTotals(s.entries, TODAY).moneyIn).toBe(1200);
  });
});

describe("readiness", () => {
  it("scores the seed companies as the prototype did", () => {
    expect(readiness(nala(), TODAY).score).toBe(5);
    expect(readiness(rekasi(), TODAY).score).toBe(80);
    expect(readiness(mabele(), TODAY).score).toBe(100);
    expect(readiness(mamaTau(), TODAY).score).toBe(55);
  });
  it("uses the prototype's hints", () => {
    const items = readiness(nala(), TODAY).items;
    expect(items.find((i) => i.key === "books_recent")!.hint).toBe("Last entry 9 days ago");
    expect(items.find((i) => i.key === "separate_money")!.hint).toBe("1 personal purchase paid from the business");
    expect(items.find((i) => i.key === "six_months")!.hint).toBe("4 months on record");
    expect(items.find((i) => i.key === "tax")!.hint).toBe("Not uploaded yet");
  });
  it("labels", () => {
    expect([70, 69, 45, 44].map(scoreLabel)).toEqual(["Funding ready", "Getting there", "Getting there", "Early"]);
  });
  it("next steps are the four biggest gaps", () => {
    expect(nextSteps(readiness(nala(), TODAY).items).map((i) => i.pts)).toEqual([15, 15, 15, 10]);
  });
});

describe("flags", () => {
  it("Nala", () => {
    expect(flags(nala(), TODAY).map((f) => f.text)).toEqual([
      "Starter account, not yet verified",
      "Personal spending from business money",
      "1 proof of payment to check",
      "2 stock items running low",
      "2 fraud warnings open",
    ]);
  });
  it("ReKasi", () => {
    expect(flags(rekasi(), TODAY).map((f) => f.text)).toEqual(["1 document waiting for a check", "Funding offer changed with no reason given"]);
  });
  it("Mama Tau", () => {
    const f = flags(mamaTau(), TODAY);
    expect(f.map((x) => x.text)).toEqual(["SARS tax registration expired", "Books not updated for 21 days", "Income fell 27% last month", "2 stock items running low"]);
    expect(byUrgency(f).map((x) => x.level)).toEqual(["bad", "bad", "warn", "warn"]);
  });
  it("no entries at all", () => {
    expect(flags({ ...mabele(), entries: [], history: [] }, TODAY).map((f) => f.text)).toContain("No bookkeeping entries");
  });
});

describe("journey", () => {
  it("Nala's five steps", () => {
    const j = journey(nala(), TODAY);
    expect(j.map((s) => s.done)).toEqual([false, false, true, false, false]);
    expect(j.map((s) => s.detail)).toEqual(["2 of 4 joining steps done", "6 entries this month", "1 payment requests open", "R1 160 on hand", "4 of 6 months of track record"]);
  });
  it("Mabele is through", () => {
    expect(journey(mabele(), TODAY).every((s) => s.done)).toBe(true);
  });
});

describe("programmes and tenders", () => {
  const p1 = { requiredDocs: ["cipc", "tax", "bank", "bplan"] as const, minMonths: 3, minScore: 40, minAmount: 10000, maxAmount: 50000 };
  const p3 = { requiredDocs: ["cipc", "tax", "bank", "bplan", "fin", "bbbee"] as const, minMonths: 12, minScore: 70, minAmount: 250000, maxAmount: 1500000 };
  const ctx = (s: ReturnType<typeof nala>) => ({ docs: s.docs, recordMonths: recordMonths(s), score: readiness(s, TODAY).score });

  it("lists gaps in the prototype's order", () => {
    expect(programmeGaps(ctx(nala()), { ...p1, requiredDocs: [...p1.requiredDocs] })).toEqual(["Verified account", "CIPC", "Tax", "Bank", "Plan", "score 40+ (you have 5)"]);
    expect(programmeGaps(ctx(mabele()), { ...p3, requiredDocs: [...p3.requiredDocs] })).toEqual(["12 months of records (you have 6)"]);
  });
  it("apply needs no gaps, an amount in range and no earlier application", () => {
    const p = { ...p1, requiredDocs: [...p1.requiredDocs] };
    expect(canApply(ctx(rekasi()), p, 50000, false)).toEqual({ ok: true });
    expect(canApply(ctx(rekasi()), p, 60000, false)).toMatchObject({ ok: false, code: "amount", message: "Enter an amount between R10 000 and R50 000" });
    expect(canApply(ctx(rekasi()), p, 50000, true)).toMatchObject({ ok: false, code: "already_applied" });
    expect(canApply(ctx(nala()), p, 20000, false)).toMatchObject({ ok: false, code: "gaps" });
  });
  it("funders only see Verified companies that share", () => {
    expect(funderVisible({ docs: nala().docs, sharing: "full" })).toBe(false);
    expect(funderVisible({ docs: rekasi().docs, sharing: "none" })).toBe(false);
    expect(funderVisible({ docs: rekasi().docs, sharing: "summary" })).toBe(true);
  });
  it("tender actions", () => {
    const t1 = { requiredDocs: ["tax", "csd", "bbbee"] as ("tax" | "csd" | "bbbee")[], minMonths: 6, sectors: ["Recycling"] };
    expect(tenderAction(ctx(nala()), t1)).toEqual({ kind: "verify_first" });
    expect(tenderAction(ctx(rekasi()), t1)).toEqual({ kind: "add_documents", missing: ["csd"] });
    expect(tenderAction(ctx(mabele()), t1)).toEqual({ kind: "can_express" });
    expect(tenderAction(ctx(mabele()), { ...t1, minMonths: 9 })).toEqual({ kind: "more_months", months: 3 });
  });
});

describe("payments", () => {
  const q = { ref: "PP-4790", amount: 250, requestedOn: "2026-10-22", rails: ["payshap", "eft", "cash"] as ("payshap" | "eft" | "cash")[] };
  it("Naledi's proof passes all five checks", () => {
    const c = proofChecks(q, { amount: 250, usedReference: true, paidOn: "2026-10-23", method: "payshap" }, false);
    expect(c.every((x) => x.ok)).toBe(true);
    expect(c.map((x) => x.text)).toEqual(["Amount matches (R250)", "Client says they used reference PP-4790", "Paid after the request was sent", "Proof file not used before", "Paid by PayShap"]);
  });
  it("a suspicious proof fails each check", () => {
    const c = proofChecks(q, { amount: 200, usedReference: false, paidOn: "2026-10-20", method: "card_machine" }, true);
    expect(c.filter((x) => !x.ok).map((x) => x.code)).toEqual(["amount", "reference", "date", "reused", "method"]);
    expect(c[0]!.text).toBe("Amount on proof is R200, request is R250");
  });
  it("second rejection flags the request", () => {
    expect(afterNotReceived(0)).toEqual({ status: "not_received", attempts: 1, raiseFraudWarning: false });
    expect(afterNotReceived(1)).toEqual({ status: "flagged", attempts: 2, raiseFraudWarning: true });
  });
  it("expires after 7 days and only open requests take proof", () => {
    expect(shouldExpire("waiting", "2026-10-17", TODAY)).toBe(false);
    expect(shouldExpire("waiting", "2026-10-16", TODAY)).toBe(true);
    expect(shouldExpire("checking", "2026-10-01", TODAY)).toBe(false);
    expect(canSendProof("waiting", ["cash"])).toBe(false);
    expect(canSendProof("not_received", ["eft"])).toBe(true);
    expect(canSendProof("flagged", ["eft"])).toBe(false);
  });
});

describe("bookkeeping", () => {
  it("warns about the same amount paid out within 7 days", () => {
    const dup = findDuplicate(nala().entries, { direction: "out", amount: 1250, date: "2026-10-20" });
    expect(dup?.note).toBe("Gel polish restock");
    expect(duplicateWarning(1250, dup!)).toBe('Possible duplicate: you paid R1 250 for "Gel polish restock" on 13 Oct. Paying the same invoice twice is a common fraud. Press Save again if this is a new payment.');
    expect(findDuplicate(nala().entries, { direction: "out", amount: 1250, date: "2026-10-21" })).toBeUndefined();
    expect(findDuplicate(nala().entries, { direction: "in", amount: 450, date: TODAY })).toBeUndefined();
  });
  it("stock movements and restock", () => {
    expect(stockDelta("in", 2)).toBe(-2);
    expect(stockDelta("out", 2)).toBe(2);
    expect(restockQuantity(3, 4)).toBe(5);
    expect(restockQuantity(9, 4)).toBe(1);
    expect(restockCost(3, 4, 85)).toBe(425);
    expect(cashPayoutCategory("recycling")).toBe("Collector payments");
    expect(cashPayoutCategory("beauty")).toBe("Other expense");
  });
});

describe("cash flow", () => {
  it("Nala's summary", () => {
    const s = cashflowSummary({ ...nala(), waitingRequests: [{ client: "Lerato", amount: 350 }] }, TODAY);
    expect(s.cash).toBe(1160);
    expect(s.usual.moneyIn).toBeCloseTo(24300 / 3);
    expect(s.usual.net).toBeCloseTo((24300 - 17900) / 3);
    expect(s.runwayMonths).toBeCloseTo(1160 / (17900 / 3));
    expect(s.personalPurchases).toBe(640);
    expect(s.restock).toEqual([{ name: "Gel polish", cost: 425 }, { name: "Lash glue", cost: 360 }]);
  });
});
