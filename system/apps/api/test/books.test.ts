import { randomUUID } from "node:crypto";
import { addDays, monthOf, todayZA } from "@proofpocket/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { signIn, testApp } from "./helpers";

const { app } = testApp();
const today = todayZA();
const KHANYA = signIn("sipho@proofpocket.example");
const MABELE = signIn("tumelo@proofpocket.example");
const post = (token: string, path: string, body: object) => request(app).post(`/api/v1${path}`).set("Authorization", token).send(body);
const get = (token: string, path: string) => request(app).get(`/api/v1${path}`).set("Authorization", token);
const entry = (over: Record<string, unknown> = {}) => ({ clientUuid: randomUUID(), direction: "out", amount: 777, method: "cash", category: "Transport", date: today, note: "Taxi to supplier", ...over });

describe("Home", () => {
  it("shows the prototype's figures for Nala", async () => {
    const r = await get(signIn("zanele@proofpocket.example"), "/founder/home");
    expect(r.status).toBe(200);
    expect(r.body.tiles).toMatchObject({ score: 5, label: "Early", tone: "bad" });
    expect(r.body.notices).toMatchObject({ starter: true, proofsToCheck: 1, fraudOpen: 2 });
    expect(r.body.flags.map((f: { text: string }) => f.text)).toContain("Starter account, not yet verified");
    expect(r.body.journey.map((j: { title: string }) => j.title)).toEqual(["Start", "Trade", "Get paid", "Manage cash flow", "Reach formal markets"]);
    expect(r.body.series).toHaveLength(6);
    expect(r.body.messages[0]).toMatchObject({ sender: "Funding Approvals Desk", verified: false });
  });
  it("is for founders only", async () => {
    expect((await get(signIn("n.mokoena@proofpocket.example"), "/founder/home")).status).toBe(403);
  });
});

describe("Bookkeeping", () => {
  it("is idempotent by client UUID (the offline outbox may send twice)", async () => {
    const e = entry({ amount: 123.45, direction: "in", category: "Sales", method: "payshap" });
    const a = await post(KHANYA, "/founder/entries", e);
    const b = await post(KHANYA, "/founder/entries", e);
    expect(a.body.created).toBe(true);
    expect(b.body.created).toBe(false);
    expect(b.body.entry.id).toBe(a.body.entry.id);
  });

  it("asks for a second confirmation for the same amount out within 7 days", async () => {
    expect((await post(KHANYA, "/founder/entries", entry())).status).toBe(200);
    const dup = await post(KHANYA, "/founder/entries", entry({ date: addDays(today, -3) }));
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/^Possible duplicate: you paid R777 for "Taxi to supplier"/);
    expect((await post(KHANYA, "/founder/entries", entry({ date: addDays(today, -3), confirmDuplicate: true }))).status).toBe(200);
  });

  it("validates categories, personal money and dates", async () => {
    expect((await post(KHANYA, "/founder/entries", entry({ category: "Sales" }))).body.error.code).toBe("validation_failed");
    expect((await post(KHANYA, "/founder/entries", entry({ direction: "in", category: "Sales", isPersonal: true }))).body.error.message).toMatch(/Only money out/);
    expect((await post(KHANYA, "/founder/entries", entry({ date: addDays(today, 2) }))).body.error.code).toBe("future_date");
    expect((await post(KHANYA, "/founder/entries", entry({ amount: 0 }))).body.error.message).toMatch(/greater than zero/);
  });

  it("personal purchases count against readiness until paid back", async () => {
    const before = (await get(KHANYA, "/founder/home")).body.tiles.score;
    const p = await post(KHANYA, "/founder/entries", entry({ amount: 64.5, category: "Other expense", isPersonal: true, note: "Groceries" }));
    expect((await get(KHANYA, "/founder/home")).body.tiles.score).toBe(before - 10);
    expect((await post(KHANYA, `/founder/entries/${p.body.entry.id}/paid-back`, {})).body.message).toBe("Marked as paid back");
    expect((await get(KHANYA, "/founder/home")).body.tiles.score).toBe(before);
  });

  it("corrections remove an entry from the totals but keep it in history", async () => {
    const e = await post(KHANYA, "/founder/entries", entry({ amount: 5000, direction: "in", category: "Sales" }));
    const t1 = (await get(KHANYA, "/founder/books")).body.totals.moneyIn;
    expect((await post(KHANYA, `/founder/entries/${e.body.entry.id}/void`, { reason: "Typed the wrong amount" })).status).toBe(200);
    const books = (await get(KHANYA, "/founder/books")).body;
    expect(books.totals.moneyIn).toBe(t1 - 5000);
    expect(books.entries.find((x: { id: string }) => x.id === e.body.entry.id)).toMatchObject({ voided: true, voidReason: "Typed the wrong amount" });
  });
});

describe("Stock", () => {
  it("Use 1 and Restock are idempotent; restock records the cost", async () => {
    const items = (await get(KHANYA, "/founder/stock")).body.items as { id: string; name: string; qty: number; reorderAt: number; cost: number }[];
    const panels = items.find((i) => i.name.startsWith("Solar panels"))!;
    const u = randomUUID();
    await post(KHANYA, `/founder/stock/${panels.id}/use`, { clientUuid: u });
    const used = await post(KHANYA, `/founder/stock/${panels.id}/use`, { clientUuid: u });
    expect(used.body.item.qty).toBe(panels.qty - 1);
    const rs = await post(KHANYA, `/founder/stock/${panels.id}/restock`, { clientUuid: randomUUID() });
    const add = Math.max(1, panels.reorderAt * 2 - (panels.qty - 1));
    expect(rs.body.item.qty).toBe(panels.qty - 1 + add);
    expect(rs.body.message).toMatch(/^Restocked Solar panels \(450 W\); R/);
    const books = (await get(KHANYA, "/founder/books")).body;
    expect(books.entries.some((e: { note: string; category: string }) => e.note.startsWith("Restock Solar panels") && e.category === "Stock and materials")).toBe(true);
  });
  it("a sale linked to stock reduces it and never below zero", async () => {
    const items = (await get(KHANYA, "/founder/stock")).body.items as { id: string; name: string; qty: number }[];
    const kits = items.find((i) => i.name === "Mounting kits")!;
    await post(KHANYA, "/founder/entries", entry({ direction: "in", category: "Sales", amount: 1500, stockItemId: kits.id, qty: kits.qty + 10 }));
    expect(((await get(KHANYA, "/founder/stock")).body.items as { name: string; qty: number }[]).find((i) => i.name === "Mounting kits")!.qty).toBe(0);
  });
  it("is off for services businesses", async () => {
    expect((await get(MABELE, "/founder/stock")).body.on).toBe(false);
    expect((await post(MABELE, "/founder/stock", { name: "Laptops" })).body.error.code).toBe("stock_off");
  });
});

describe("Statements, earlier months and settings", () => {
  async function uploadCsv(token: string, csv: string) {
    const buf = Buffer.from(csv);
    const s = await post(token, "/founder/uploads", { purpose: "statement", name: "statement.csv", contentType: "text/csv", size: buf.length });
    await request(app).put(s.body.upload.url).set("Content-Type", "text/csv").send(buf);
    const done = await post(token, `/founder/uploads/${s.body.fileId}/complete`, {});
    expect(done.status).toBe(200);
    return s.body.fileId as string;
  }

  it("imports lines, marks ones already in the books, and doesn't import a line twice", async () => {
    const d = addDays(today, -1).replace(/-/g, "/");
    await post(MABELE, "/founder/entries", { clientUuid: randomUUID(), direction: "in", amount: 4321, method: "eft", category: "Services", date: addDays(today, -1), note: "Co-op fees" });
    const csv = `Date,Description,Amount,Balance\n${d},CO-OP FEES EFT,4321.00,1\n${d},AIRTIME VODACOM,-99.00,1\n`;
    const r = await post(MABELE, "/founder/statements", { fileId: await uploadCsv(MABELE, csv) });
    expect(r.body).toMatchObject({ ok: true, added: 2, alreadyInBooks: 1 });
    const again = await post(MABELE, "/founder/statements", { fileId: await uploadCsv(MABELE, csv) });
    expect(again.body).toMatchObject({ added: 0, repeated: 2 });
    const lines = (await get(MABELE, "/founder/books")).body.statementLines as { id: string; description: string; status: string }[];
    expect(lines.find((l) => l.description === "CO-OP FEES EFT")!.status).toBe("already_in_books");
    const airtime = lines.find((l) => l.description === "AIRTIME VODACOM")!;
    expect((await post(MABELE, `/founder/statement-lines/${airtime.id}`, { action: "add", category: "Airtime and data" })).body.message).toBe("Added to your books");
  });

  it("asks for the columns when the CSV has no headings", async () => {
    const id = await uploadCsv(MABELE, "2026/10/01,SOMETHING,-10\n");
    expect((await post(MABELE, "/founder/statements", { fileId: id })).body).toMatchObject({ ok: false, needsMapping: true, columnCount: 3 });
  });

  it("earlier months only", async () => {
    expect((await request(app).put("/api/v1/founder/history").set("Authorization", MABELE).send({ month: monthOf(today), moneyIn: 1, moneyOut: 1 })).body.error.code).toBe("not_earlier");
    expect((await request(app).put("/api/v1/founder/history").set("Authorization", MABELE).send({ month: "2025-06", moneyIn: 30000, moneyOut: 25000 })).status).toBe(200);
  });

  it("opening balance with a date drives cash on hand", async () => {
    const before = (await get(MABELE, "/founder/cashflow")).body.cash;
    const s = (await get(MABELE, "/founder/settings")).body;
    await request(app).put("/api/v1/founder/settings").set("Authorization", MABELE).send({ ...s, openingBalance: s.openingBalance + 1000, sector: undefined, businessType: undefined });
    expect((await get(MABELE, "/founder/cashflow")).body.cash).toBe(before + 1000);
  });
});
