// Bookkeeping, stock, statements and settings (v2/app.js vBooks, vStock, entry submit, inboxok, stockuse/stockbuy).
import { randomUUID } from "node:crypto";
import {
  addDays, clampQty, duplicateWarning, findDuplicate, matchExisting, methodFromDescription, monthOf, R, restockQuantity,
  sameLine, stockDelta, todayZA, velocityFlag, type EntryInput, type StatementLine, requestItemsShortfall, requestItemsTotal,
} from "@proofpocket/shared";
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, files, ledgerEntries, monthlyHistory, paymentRequestItems, statementImports, statementLines, stockItems, stockMovements } from "../db/schema/index";
import { addActivity, audit, type Actor } from "../lib/audit";
import { AppError, badRequest, notFound } from "../lib/errors";
import type { FileStore } from "../lib/storage";
import { parsePdfStatement, parseStatement, type Mapping } from "../lib/statements";
import { pdfTextLines } from "../lib/statement-pdf";
import type { CompanyRow } from "../repositories/companies";
import { requireRegisteredFile } from "./files";

const money = (n: number) => n.toFixed(2);
const num = (v: string | null) => (v === null ? null : Number(v));
type Entry = typeof ledgerEntries.$inferSelect;

export function entryView(e: Entry) {
  return {
    id: e.id, clientUuid: e.clientUuid, date: e.entryDate, direction: e.direction, amount: Number(e.amount), method: e.method, category: e.category,
    note: e.note, isPersonal: e.isPersonal && !e.paidBackAt, paidBack: e.paidBackAt !== null, receipt: e.receiptKept || e.receiptFileId !== null,
    receiptFileId: e.receiptFileId, source: e.source, slipNumber: e.slipNumber, voided: e.voidedAt !== null, voidReason: e.voidReason,
  };
}

// ---------------------------------------------------------------- stock
export async function stockList(tx: Tx, companyId: string) {
  const rows = await tx.select({
    id: stockItems.id, name: stockItems.name, unit: stockItems.unit, reorderAt: stockItems.reorderAt, cost: stockItems.cost, price: stockItems.price,
    // Qualified explicitly: an unqualified "id" here would resolve to stock_movements.id.
    qty: sql<string>`coalesce((select sum(m.delta) from stock_movements m where m.stock_item_id = "stock_items"."id"), 0)`,
  }).from(stockItems).where(and(eq(stockItems.companyId, companyId), isNull(stockItems.archivedAt))).orderBy(asc(stockItems.name));
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, qty: Number(r.qty), reorderAt: Number(r.reorderAt), cost: Number(r.cost), price: Number(r.price), low: Number(r.qty) <= Number(r.reorderAt) }));
}

async function stockItem(tx: Tx, companyId: string, id: string) {
  const item = (await stockList(tx, companyId)).find((s) => s.id === id);
  if (!item) throw notFound("That stock item");
  return item;
}

/** A payment request's stock lines, priced from each item's selling price (the founder's own, current stock only). */
export async function priceRequestItems(tx: Tx, companyId: string, lines: { stockItemId: string; qty: number }[]) {
  if (!lines.length) return { items: [], total: 0, shortfall: [] as string[] };
  const stock = await stockList(tx, companyId);
  const items = lines.map((l) => {
    const s = stock.find((x) => x.id === l.stockItemId);
    if (!s) throw notFound("That stock item");
    return { stockItemId: s.id, name: s.name, qty: l.qty, unitPrice: s.price, inStock: s.qty };
  });
  if (items.some((i) => i.unitPrice <= 0)) throw badRequest("no_price", `Add a selling price for ${items.find((i) => i.unitPrice <= 0)!.name} under Stock first.`);
  return {
    items,
    total: requestItemsTotal(items.map((i) => ({ price: i.unitPrice, qty: i.qty }))),
    shortfall: requestItemsShortfall(items.map((i) => ({ name: i.name, qty: i.qty, inStock: i.inStock }))),
  };
}

/** When a request built from stock is paid: its lines come off stock, linked to the income entry. */
export async function takeRequestStock(tx: Tx, actor: Actor, c: CompanyRow, paymentRequestId: string, ledgerEntryId: string) {
  const lines = await tx.select().from(paymentRequestItems).where(eq(paymentRequestItems.paymentRequestId, paymentRequestId));
  for (const l of lines) await move(tx, c, l.stockItemId, -Number(l.qty), "sale", randomUUID(), actor, ledgerEntryId);
}

/** Adds a stock movement, never taking the quantity below zero. Idempotent by client UUID. */
async function move(tx: Tx, c: CompanyRow, itemId: string, delta: number, reason: string, clientUuid: string, actor: Actor, ledgerEntryId?: string) {
  const [done] = await tx.select().from(stockMovements).where(eq(stockMovements.clientUuid, clientUuid));
  if (done) return Number(done.delta);
  const item = await stockItem(tx, c.id, itemId);
  const applied = clampQty(item.qty + delta) - item.qty;
  await tx.insert(stockMovements).values({ companyId: c.id, stockItemId: itemId, clientUuid, delta: money(applied), reason, ledgerEntryId, createdBy: actor.userId });
  return applied;
}

export async function addStockItem(tx: Tx, actor: Actor, c: CompanyRow, s: { name: string; unit: string; qty: number; reorderAt: number; cost: number; price: number }) {
  const [item] = await tx.insert(stockItems).values({ companyId: c.id, name: s.name, unit: s.unit || "units", reorderAt: money(s.reorderAt), cost: money(s.cost), price: money(s.price) }).returning();
  if (s.qty > 0) await tx.insert(stockMovements).values({ companyId: c.id, stockItemId: item!.id, clientUuid: randomUUID(), delta: money(s.qty), reason: "opening", createdBy: actor.userId });
  return item!;
}

export async function useStock(tx: Tx, actor: Actor, c: CompanyRow, id: string, clientUuid: string) {
  const item = await stockItem(tx, c.id, id);
  await move(tx, c, id, -1, "use", clientUuid, actor);
  const after = await stockItem(tx, c.id, id);
  return { message: `${item.name}: ${after.qty} ${item.unit} left`, item: after };
}

/** Tops up to twice the reorder level and records the cost as money out (v2: stockbuy). */
export async function restock(tx: Tx, actor: Actor, c: CompanyRow, id: string, clientUuid: string) {
  const [existing] = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.clientUuid, clientUuid));
  const item = await stockItem(tx, c.id, id);
  if (existing) return { message: `Restocked ${item.name}`, item };
  const add = restockQuantity(item.qty, item.reorderAt);
  const cost = Math.round(add * item.cost);
  let entryId: string | undefined;
  if (cost > 0) {
    const [e] = await tx.insert(ledgerEntries).values({
      companyId: c.id, clientUuid, entryDate: todayZA(), direction: "out", amount: money(cost), method: "eft", category: "Stock and materials",
      note: `Restock ${item.name} (${add} ${item.unit})`, receiptKept: true, stockItemId: id, qty: money(add), source: "restock", createdBy: actor.userId,
    }).returning();
    entryId = e!.id;
  }
  await move(tx, c, id, add, "restock", entryId ? randomUUID() : clientUuid, actor, entryId);
  await addActivity(tx, c.id, `Restocked ${item.name} (${add} ${item.unit}), ${R(cost)}.`, actor.userId);
  return { message: `Restocked ${item.name}; ${R(cost)} added to your books`, item: await stockItem(tx, c.id, id) };
}

// ---------------------------------------------------------------- entries
export async function recentOut(tx: Tx, companyId: string, around: string) {
  const rows = await tx.select().from(ledgerEntries).where(and(eq(ledgerEntries.companyId, companyId), eq(ledgerEntries.direction, "out"), isNull(ledgerEntries.voidedAt),
    gte(ledgerEntries.entryDate, addDays(around, -7)), lte(ledgerEntries.entryDate, addDays(around, 7))));
  return rows.map((e) => ({ date: e.entryDate, direction: e.direction, amount: Number(e.amount), category: e.category, method: e.method, isPersonal: e.isPersonal, note: e.note }));
}

/**
 * Records a book entry. Safe to send twice (the offline outbox may): the client UUID makes it idempotent.
 * Same-amount money out within 7 days is refused until the founder confirms it (v2: "Possible duplicate").
 */
export async function addEntry(tx: Tx, actor: Actor, c: CompanyRow, e: EntryInput, opts: { source?: Entry["source"]; slipNumber?: string | null; paymentRequestId?: string; paymentProofId?: string; supplierId?: string; statementLineId?: string } = {}) {
  const [existing] = await tx.select().from(ledgerEntries).where(eq(ledgerEntries.clientUuid, e.clientUuid));
  if (existing) {
    if (existing.companyId !== c.id) throw new AppError(409, "uuid_clash", "Try saving again.");
    return { entry: entryView(existing), created: false };
  }
  const today = todayZA();
  if (e.date > today) throw badRequest("future_date", "The date can't be in the future.");
  if (e.date < addDays(today, -730)) throw badRequest("old_date", "For entries older than two years, add the month's totals under Earlier months.");
  if (!e.confirmDuplicate) {
    const dup = findDuplicate(await recentOut(tx, c.id, e.date), e);
    if (dup) throw new AppError(409, "possible_duplicate", duplicateWarning(e.amount, dup));
  }
  if (e.receiptFileId) await requireRegisteredFile(tx, e.receiptFileId, c.id, "receipt");
  const [row] = await tx.insert(ledgerEntries).values({
    companyId: c.id, clientUuid: e.clientUuid, entryDate: e.date, direction: e.direction, amount: money(e.amount), method: e.method, category: e.category,
    note: e.note, isPersonal: e.direction === "out" && e.isPersonal, receiptFileId: e.receiptFileId ?? null, receiptKept: !!e.receiptFileId,
    stockItemId: e.stockItemId ?? null, qty: e.qty ? money(e.qty) : null, source: opts.source ?? "manual", slipNumber: opts.slipNumber ?? null,
    paymentRequestId: opts.paymentRequestId, paymentProofId: opts.paymentProofId, supplierId: opts.supplierId, statementLineId: opts.statementLineId,
    createdBy: actor.userId,
  }).returning();
  if (e.stockItemId && e.qty) await move(tx, c, e.stockItemId, stockDelta(e.direction, e.qty), e.direction === "in" ? "sale" : "purchase", randomUUID(), actor, row!.id);
  await addActivity(tx, c.id, `Recorded ${e.direction === "in" ? "income" : "an expense"} of ${R(e.amount)}.`, actor.userId);

  // Behavioural velocity check: flag unnatural bursts of manual cash entries (anti-gaming).
  // Only runs for manual entries so automated flows (payfast_itn, proof, restock) are not flagged.
  if ((opts.source ?? "manual") === "manual" && e.method === "cash") {
    const recent = await tx.select({ createdAt: ledgerEntries.createdAt })
      .from(ledgerEntries)
      .where(and(eq(ledgerEntries.companyId, c.id), isNull(ledgerEntries.voidedAt)))
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(20);
    const flag = velocityFlag(recent.map((r) => r.createdAt));
    if (flag) {
      await addActivity(tx, c.id, `⚠️ ${flag}`, actor.userId);
    }
  }

  return { entry: entryView(row!), created: true };
}

export async function paidBack(tx: Tx, actor: Actor, c: CompanyRow, id: string) {
  const [e] = await tx.select().from(ledgerEntries).where(and(eq(ledgerEntries.id, id), eq(ledgerEntries.companyId, c.id)));
  if (!e) throw notFound("That entry");
  if (!e.isPersonal || e.paidBackAt) throw badRequest("not_personal", "This entry isn't an unpaid personal purchase.");
  await tx.update(ledgerEntries).set({ paidBackAt: new Date(), note: `${e.note} (paid back)`.trim() }).where(eq(ledgerEntries.id, id));
  await addActivity(tx, c.id, `Personal purchase of ${R(Number(e.amount))} paid back to the business.`, actor.userId);
  return { message: "Marked as paid back" };
}

/** Corrections void the entry (kept for funders and the audit trail) instead of deleting it. */
export async function voidEntry(tx: Tx, actor: Actor, c: CompanyRow, id: string, reason: string) {
  const [e] = await tx.select().from(ledgerEntries).where(and(eq(ledgerEntries.id, id), eq(ledgerEntries.companyId, c.id)));
  if (!e) throw notFound("That entry");
  if (e.voidedAt) return { message: "Already removed from your totals" };
  if (e.source === "proof") throw badRequest("paid_request", "This came from a confirmed payment request. Ask your adviser to correct it.");
  await tx.update(ledgerEntries).set({ voidedAt: new Date(), voidReason: reason }).where(eq(ledgerEntries.id, id));
  const moves = await tx.select().from(stockMovements).where(eq(stockMovements.ledgerEntryId, id));
  for (const m of moves) await tx.insert(stockMovements).values({ companyId: c.id, stockItemId: m.stockItemId, clientUuid: randomUUID(), delta: money(-Number(m.delta)), reason: "correction", ledgerEntryId: id, createdBy: actor.userId });
  await addActivity(tx, c.id, `Removed an entry of ${R(Number(e.amount))} from the books: ${reason}`, actor.userId);
  await audit(tx, actor, { action: "entry.voided", entity: "ledger_entry", entityId: id, companyId: c.id, before: entryView(e), after: { reason } });
  return { message: "Removed from your totals. It stays in your history." };
}

export async function monthEntries(tx: Tx, companyId: string, month: string) {
  const rows = await tx.select().from(ledgerEntries)
    .where(and(eq(ledgerEntries.companyId, companyId), gte(ledgerEntries.entryDate, `${month}-01`), lte(ledgerEntries.entryDate, `${month}-31`)))
    .orderBy(desc(ledgerEntries.entryDate), desc(ledgerEntries.createdAt));
  return rows.map(entryView);
}

// ---------------------------------------------------------------- statements
export async function importStatement(tx: Tx, store: FileStore, actor: Actor, c: CompanyRow, fileId: string, mapping?: Mapping, password?: string) {
  const file = await requireRegisteredFile(tx, fileId, c.id, "statement");
  const data = await store.read(file.bucketPath);
  const pdf = file.mime === "application/pdf";
  const parsed = pdf ? { ok: true as const, ...parsePdfStatement(await pdfTextLines(data, password)) } : parseStatement(data.toString("utf8"), mapping);
  if (!parsed.ok) return parsed;
  if (!parsed.lines.length) throw badRequest("no_lines", pdf
    ? "We couldn't find any transactions in that PDF. If it's from a bank other than FNB, Capitec, Absa, Standard Bank, Nedbank or TymeBank, add the entries in Bookkeeping instead."
    : "We couldn't find any transactions in that file.");
  const from = parsed.lines.map((l) => l.date).sort()[0]!;
  const entries = (await tx.select().from(ledgerEntries).where(and(eq(ledgerEntries.companyId, c.id), isNull(ledgerEntries.voidedAt), gte(ledgerEntries.entryDate, addDays(from, -3)))))
    .map((e) => ({ id: e.id, date: e.entryDate, amount: Number(e.amount), direction: e.direction, note: e.note }));
  const earlier = (await tx.select().from(statementLines).where(and(eq(statementLines.companyId, c.id), gte(statementLines.lineDate, from))))
    .map((l): StatementLine => ({ date: l.lineDate, description: l.description, amount: Number(l.amount), direction: l.direction }));
  const fresh = parsed.lines.filter((l) => !earlier.some((x) => sameLine(x, l)));
  const [imp] = await tx.insert(statementImports).values({ companyId: c.id, fileId, bank: parsed.bank, format: pdf ? "pdf" : "csv", lineCount: fresh.length, importedBy: actor.userId }).returning();
  let already = 0;
  if (fresh.length) {
    await tx.insert(statementLines).values(fresh.map((l) => {
      const m = matchExisting(l, entries);
      if (m) already++;
      return { companyId: c.id, importId: imp!.id, lineDate: l.date, description: l.description, amount: money(l.amount), direction: l.direction, status: m ? "already_in_books" as const : "unsorted" as const, matchedEntryId: m?.id ?? null };
    }));
  }
  await addActivity(tx, c.id, `Imported a bank statement (${fresh.length} lines).`, actor.userId);
  return { ok: true as const, added: fresh.length, alreadyInBooks: already, repeated: parsed.lines.length - fresh.length, skipped: parsed.skipped, bank: parsed.bank };
}

export async function openStatementLines(tx: Tx, companyId: string) {
  const rows = await tx.select({ l: statementLines, matchedNote: ledgerEntries.note, matchedDate: ledgerEntries.entryDate }).from(statementLines)
    .leftJoin(ledgerEntries, eq(ledgerEntries.id, statementLines.matchedEntryId))
    .where(and(eq(statementLines.companyId, companyId), inArray(statementLines.status, ["unsorted", "already_in_books"])))
    .orderBy(desc(statementLines.lineDate));
  return rows.map(({ l, matchedNote, matchedDate }) => ({
    id: l.id, date: l.lineDate, description: l.description, amount: Number(l.amount), direction: l.direction, status: l.status,
    matched: matchedNote ? { note: matchedNote, date: matchedDate } : null,
  }));
}

export async function sortLine(tx: Tx, actor: Actor, c: CompanyRow, id: string, action: "add" | "personal" | "skip", category?: string) {
  const [l] = await tx.select().from(statementLines).where(and(eq(statementLines.id, id), eq(statementLines.companyId, c.id)));
  if (!l) throw notFound("That statement line");
  if (l.status !== "unsorted" && l.status !== "already_in_books") return { message: "Already sorted" };
  if (action === "skip") {
    await tx.update(statementLines).set({ status: "skipped" }).where(eq(statementLines.id, id));
    return { message: "Left out of your books" };
  }
  if (action === "personal" && l.direction !== "out") throw badRequest("not_out", "Only money out can be personal.");
  const cat = action === "personal" ? "Other expense" : category ?? (l.direction === "in" ? "Sales" : "Other expense");
  const { entry } = await addEntry(tx, actor, c, {
    clientUuid: randomUUID(), direction: l.direction, amount: Number(l.amount), method: methodFromDescription(l.description), category: cat,
    date: l.lineDate, note: l.description, isPersonal: action === "personal", confirmDuplicate: true,
  }, { source: "statement", statementLineId: l.id });
  await tx.update(ledgerEntries).set({ receiptKept: true }).where(eq(ledgerEntries.id, entry.id));
  await tx.update(statementLines).set({ status: action === "personal" ? "personal" : "added", ledgerEntryId: entry.id }).where(eq(statementLines.id, id));
  return { message: action === "personal" ? "Added and marked personal" : "Added to your books" };
}

// ---------------------------------------------------------------- earlier months, settings
export async function historyList(tx: Tx, companyId: string) {
  const rows = await tx.select().from(monthlyHistory).where(eq(monthlyHistory.companyId, companyId)).orderBy(desc(monthlyHistory.month));
  return rows.map((h) => ({ month: h.month.slice(0, 7), moneyIn: Number(h.moneyIn), moneyOut: Number(h.moneyOut), source: h.source }));
}

export async function saveHistory(tx: Tx, actor: Actor, c: CompanyRow, h: { month: string; moneyIn: number; moneyOut: number }) {
  if (h.month >= monthOf(todayZA())) throw badRequest("not_earlier", "Earlier months only. Record this month's money as book entries.");
  await tx.insert(monthlyHistory).values({ companyId: c.id, month: `${h.month}-01`, moneyIn: money(h.moneyIn), moneyOut: money(h.moneyOut) })
    .onConflictDoUpdate({ target: [monthlyHistory.companyId, monthlyHistory.month], set: { moneyIn: money(h.moneyIn), moneyOut: money(h.moneyOut), updatedAt: new Date() } });
  await audit(tx, actor, { action: "history.saved", entity: "monthly_history", entityId: h.month, companyId: c.id, after: h });
  return { message: `${h.month} saved` };
}

export async function saveSettings(tx: Tx, actor: Actor, c: CompanyRow, s: { openingBalance: number; openingBalanceDate: string; employees: number; foundedYear: number; stage: string }) {
  if (s.openingBalanceDate > todayZA()) throw badRequest("future_date", "The opening balance date can't be in the future.");
  await tx.update(companies).set({ openingBalance: money(s.openingBalance), openingBalanceDate: s.openingBalanceDate, employees: s.employees, foundedYear: s.foundedYear, stage: s.stage }).where(eq(companies.id, c.id));
  await audit(tx, actor, { action: "settings.saved", entity: "company", entityId: c.id, companyId: c.id, before: { openingBalance: num(c.openingBalance), openingBalanceDate: c.openingBalanceDate, employees: c.employees, foundedYear: c.foundedYear }, after: s });
  return { message: "Settings saved" };
}

export async function receiptUrl(tx: Tx, store: FileStore, c: CompanyRow, fileId: string) {
  const [f] = await tx.select().from(files).where(and(eq(files.id, fileId), eq(files.companyId, c.id)));
  if (!f) throw notFound("That receipt");
  return store.downloadUrl(f.bucketPath, f.originalName, f.mime);
}

