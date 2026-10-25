// Founder: Home, Bookkeeping, Stock, Cash flow and Business settings (Phase 3).
import {
  BUSINESS_TYPES, cashflowSummary, clientUuidSchema, entrySchema, fraudOpen, historyMonthSchema, monthOf, monthTotals, nextSteps, scoreLabel, scoreTone,
  settingsSchema, statementImportSchema, statementLineActionSchema, stockEditSchema, stockItemSchema, todayZA, cashOnHand, lastEntryDays, voidSchema,
} from "@proofpocket/shared";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext, type Tx } from "../db/client";
import { messages, paymentRequests, stockItems } from "../db/schema/index";
import { badRequest, notFound } from "../lib/errors";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany, type CompanyRow } from "../repositories/companies";
import {
  addEntry, addStockItem, historyList, importStatement, monthEntries, openStatementLines, paidBack, restock, saveHistory, saveSettings, sortLine,
  stockList, useStock, voidEntry,
} from "../services/books";
import { loadSnapshot, summarise } from "../services/snapshot";

const monthParam = z.string().regex(/^\d{4}-\d{2}$/).optional();

export function founderBookRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);
  /** Runs fn as the signed-in founder, with their (joined) company. */
  const asFounder = <T>(req: Request, fn: (tx: Tx, c: CompanyRow) => Promise<T>) =>
    withContext(deps.db, contextOf(req), async (tx) => fn(tx, await myCompany(tx, req.auth!.user!.id)));

  // ------------------------------------------------------------ Home
  r.get("/founder/home", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const s = await loadSnapshot(tx, c.id);
    const sum = summarise(s, today);
    const t = monthTotals(s.entries, today);
    const recent = await tx.select().from(messages).where(eq(messages.companyId, c.id)).orderBy(desc(messages.createdAt)).limit(4);
    return {
      company: { name: c.name, town: c.town, province: c.province, typeLabel: BUSINESS_TYPES[c.businessType].label, area: c.area, employees: c.employees, foundedYear: c.foundedYear, verified: c.verifiedAt !== null },
      notices: { starter: c.verifiedAt === null, proofsToCheck: s.paymentRequests.filter((p) => p.status === "checking").length, fraudOpen: fraudOpen(s) },
      journey: sum.journey,
      tiles: { moneyIn: t.moneyIn, moneyOut: t.moneyOut, cash: cashOnHand(s), score: sum.readiness.score, label: scoreLabel(sum.readiness.score), tone: scoreTone(sum.readiness.score) },
      series: sum.series,
      nextSteps: nextSteps(sum.readiness.items),
      flags: sum.flags,
      messages: recent.map((m) => ({ id: m.id, sender: m.sender, verified: m.verifiedSender, body: m.body })),
    };
  })));

  // ------------------------------------------------------------ Bookkeeping
  r.get("/founder/books", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const month = parse(monthParam, req.query.month) ?? monthOf(today);
    const entries = await monthEntries(tx, c.id, month);
    const live = entries.filter((e) => !e.voided);
    const s = await loadSnapshot(tx, c.id);
    return {
      month,
      entries,
      totals: { moneyIn: live.filter((e) => e.direction === "in").reduce((a, e) => a + e.amount, 0), moneyOut: live.filter((e) => e.direction === "out").reduce((a, e) => a + e.amount, 0) },
      lastEntryDays: Number.isFinite(lastEntryDays(s.entries, today)) ? lastEntryDays(s.entries, today) : null,
      statementLines: await openStatementLines(tx, c.id),
      stock: BUSINESS_TYPES[c.businessType].stock ? await stockList(tx, c.id) : [],
      stockOn: BUSINESS_TYPES[c.businessType].stock,
      history: await historyList(tx, c.id),
    };
  })));

  r.post("/founder/entries", founder, handle((req) => {
    const e = parse(entrySchema, req.body);
    return asFounder(req, async (tx, c) => {
      const res = await addEntry(tx, actorOf(req), c, e);
      return { ...res, message: "Saved to your books" };
    });
  }));
  r.post("/founder/entries/:id/paid-back", founder, handle((req) => asFounder(req, (tx, c) => paidBack(tx, actorOf(req), c, String(req.params.id)))));
  r.post("/founder/entries/:id/void", founder, handle((req) => {
    const { reason } = parse(voidSchema, req.body);
    return asFounder(req, (tx, c) => voidEntry(tx, actorOf(req), c, String(req.params.id), reason));
  }));

  r.post("/founder/statements", founder, handle((req) => {
    const { fileId, mapping } = parse(statementImportSchema, req.body);
    return asFounder(req, (tx, c) => importStatement(tx, deps.store, actorOf(req), c, fileId, mapping));
  }));
  r.post("/founder/statement-lines/:id", founder, handle((req) => {
    const { action, category } = parse(statementLineActionSchema, req.body);
    return asFounder(req, (tx, c) => sortLine(tx, actorOf(req), c, String(req.params.id), action, category));
  }));

  r.put("/founder/history", founder, handle((req) => {
    const h = parse(historyMonthSchema, req.body);
    return asFounder(req, (tx, c) => saveHistory(tx, actorOf(req), c, h));
  }));

  // ------------------------------------------------------------ Stock
  const stockOn = (c: CompanyRow) => { if (!BUSINESS_TYPES[c.businessType].stock) throw badRequest("stock_off", `Stock tracking is off for ${BUSINESS_TYPES[c.businessType].label} businesses.`); };
  r.get("/founder/stock", founder, handle((req) => asFounder(req, async (tx, c) => {
    const items = BUSINESS_TYPES[c.businessType].stock ? await stockList(tx, c.id) : [];
    return { on: BUSINESS_TYPES[c.businessType].stock, typeLabel: BUSINESS_TYPES[c.businessType].label, items, value: items.reduce((a, s) => a + s.qty * s.cost, 0), low: items.filter((s) => s.low).length };
  })));
  r.post("/founder/stock", founder, handle((req) => {
    const s = parse(stockItemSchema, req.body);
    return asFounder(req, async (tx, c) => { stockOn(c); await addStockItem(tx, actorOf(req), c, s); return { message: "Item added" }; });
  }));
  r.patch("/founder/stock/:id", founder, handle((req) => {
    const s = parse(stockEditSchema, req.body);
    return asFounder(req, async (tx, c) => {
      const rows = await tx.update(stockItems).set({
        ...(s.name ? { name: s.name } : {}), ...(s.unit ? { unit: s.unit } : {}),
        ...(s.reorderAt !== undefined ? { reorderAt: s.reorderAt.toFixed(2) } : {}), ...(s.cost !== undefined ? { cost: s.cost.toFixed(2) } : {}),
      }).where(and(eq(stockItems.id, String(req.params.id)), eq(stockItems.companyId, c.id), isNull(stockItems.archivedAt))).returning({ id: stockItems.id });
      if (!rows.length) throw notFound("That item");
      return { message: "Item updated" };
    });
  }));
  r.delete("/founder/stock/:id", founder, handle((req) => asFounder(req, async (tx, c) => {
    const rows = await tx.update(stockItems).set({ archivedAt: new Date() }).where(and(eq(stockItems.id, String(req.params.id)), eq(stockItems.companyId, c.id), isNull(stockItems.archivedAt))).returning({ id: stockItems.id });
    if (!rows.length) throw notFound("That item");
    return { message: "Item removed" };
  })));
  r.post("/founder/stock/:id/use", founder, handle((req) => {
    const { clientUuid } = parse(clientUuidSchema, req.body);
    return asFounder(req, async (tx, c) => { stockOn(c); return useStock(tx, actorOf(req), c, String(req.params.id), clientUuid); });
  }));
  r.post("/founder/stock/:id/restock", founder, handle((req) => {
    const { clientUuid } = parse(clientUuidSchema, req.body);
    return asFounder(req, async (tx, c) => { stockOn(c); return restock(tx, actorOf(req), c, String(req.params.id), clientUuid); });
  }));

  // ------------------------------------------------------------ Cash flow
  r.get("/founder/cashflow", founder, handle((req) => asFounder(req, async (tx, c) => {
    const today = todayZA();
    const s = await loadSnapshot(tx, c.id);
    const waiting = await tx.select({ client: paymentRequests.clientName, amount: paymentRequests.amount }).from(paymentRequests)
      .where(and(eq(paymentRequests.companyId, c.id), eq(paymentRequests.status, "waiting")));
    return {
      openingBalance: Number(c.openingBalance), openingBalanceDate: c.openingBalanceDate,
      ...cashflowSummary({ ...s, waitingRequests: waiting.map((w) => ({ client: w.client, amount: Number(w.amount) })) }, today),
      series: summarise(s, today).series,
    };
  })));

  // ------------------------------------------------------------ Business settings
  r.get("/founder/settings", founder, handle((req) => asFounder(req, async (_tx, c) => ({
    openingBalance: Number(c.openingBalance), openingBalanceDate: c.openingBalanceDate, employees: c.employees, foundedYear: c.foundedYear, stage: c.stage,
    sector: c.sector, businessType: c.businessType,
  }))));
  r.put("/founder/settings", founder, handle((req) => {
    const s = parse(settingsSchema, req.body);
    return asFounder(req, (tx, c) => saveSettings(tx, actorOf(req), c, s));
  }));

  return r;
}
