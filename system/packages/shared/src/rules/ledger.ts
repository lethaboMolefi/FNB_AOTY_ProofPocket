// Figures derived from the books: v2/app.js monthTotals, series, recordMonths, lastEntryDays, cashNow, avg, lowStock.
import { addMonths, daysBetween, monthLabel, monthOf, monthsEnding } from "../dates";
import type { CompanySnapshot, EntryLite, MonthTotals, StockLite } from "../types";

export const liveEntries = (entries: EntryLite[]) => entries.filter((e) => !e.voided);

function totals(entries: EntryLite[]) {
  let moneyIn = 0, moneyOut = 0;
  for (const e of entries) {
    if (e.direction === "in") moneyIn += e.amount;
    else moneyOut += e.amount;
  }
  return { moneyIn, moneyOut, profit: moneyIn - moneyOut };
}

/** Money in, money out and profit for the calendar month of `today`. */
export function monthTotals(entries: EntryLite[], today: string) {
  const m = monthOf(today);
  return totals(liveEntries(entries).filter((e) => monthOf(e.date) === m));
}

/**
 * Totals per month. A month with book entries uses the entries; otherwise the
 * imported history for that month, so a month is never counted twice.
 */
export function totalsByMonth(s: Pick<CompanySnapshot, "entries" | "history">): Map<string, MonthTotals> {
  const out = new Map<string, MonthTotals>();
  for (const h of s.history) out.set(h.month, { ...h });
  const byMonth = new Map<string, EntryLite[]>();
  for (const e of liveEntries(s.entries)) {
    const m = monthOf(e.date);
    byMonth.set(m, [...(byMonth.get(m) ?? []), e]);
  }
  for (const [m, list] of byMonth) {
    const t = totals(list);
    out.set(m, { month: m, moneyIn: t.moneyIn, moneyOut: t.moneyOut });
  }
  return out;
}

export interface SeriesPoint { month: string; label: string; moneyIn: number; moneyOut: number; current: boolean }

/** Five earlier months plus this month (labelled with *), as on the prototype charts. */
export function series(s: Pick<CompanySnapshot, "entries" | "history">, today: string): SeriesPoint[] {
  const by = totalsByMonth(s);
  const months = monthsEnding(today, 6);
  return months.map((m, i) => {
    const t = by.get(m);
    const current = i === months.length - 1;
    return { month: m, label: monthLabel(m) + (current ? "*" : ""), moneyIn: t?.moneyIn ?? 0, moneyOut: t?.moneyOut ?? 0, current };
  });
}

/**
 * Months with any money in or out, over the company's whole record (inventory 12.10a).
 * The prototype could count at most six; programmes may ask for twelve or more.
 */
export function recordMonths(s: Pick<CompanySnapshot, "entries" | "history">): number {
  let n = 0;
  for (const t of totalsByMonth(s).values()) if (t.moneyIn + t.moneyOut > 0) n++;
  return n;
}

/** Days since the latest book entry; Infinity when there are none. */
export function lastEntryDays(entries: EntryLite[], today: string): number {
  const live = liveEntries(entries);
  if (!live.length) return Infinity;
  const last = live.map((e) => e.date).sort().pop()!;
  return Math.max(0, daysBetween(last, today));
}

export function entriesThisMonth(entries: EntryLite[], today: string): EntryLite[] {
  const m = monthOf(today);
  return liveEntries(entries).filter((e) => monthOf(e.date) === m);
}

/**
 * Cash on hand = opening balance + every entry on or after the opening balance date
 * (inventory 12.9; the prototype added only this month's profit to a start-of-month figure).
 */
export function cashOnHand(s: Pick<CompanySnapshot, "entries" | "openingBalance" | "openingBalanceDate">): number {
  const t = totals(liveEntries(s.entries).filter((e) => e.date >= s.openingBalanceDate));
  return s.openingBalance + t.profit;
}

/** Average money in and out over the five earlier months that had activity. */
export function usualMonth(s: Pick<CompanySnapshot, "entries" | "history">, today: string) {
  const earlier = series(s, today).slice(0, 5).filter((m) => m.moneyIn + m.moneyOut > 0);
  if (!earlier.length) return { moneyIn: 0, moneyOut: 0 };
  return {
    moneyIn: earlier.reduce((a, m) => a + m.moneyIn, 0) / earlier.length,
    moneyOut: earlier.reduce((a, m) => a + m.moneyOut, 0) / earlier.length,
  };
}

export const lowStock = (stock: StockLite[]) => stock.filter((x) => x.qty <= x.reorderAt);

/** The month before `month`, as YYYY-MM. */
export const previousMonth = (month: string) => addMonths(month, -1);
