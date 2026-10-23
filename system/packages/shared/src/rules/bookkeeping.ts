// Bookkeeping checks: duplicate payments, stock, cash payouts (v2/app.js entry submit, stockbuy, cashout).
import type { BusinessType } from "../constants";
import { daysBetween } from "../dates";
import { R, shortDate } from "../format";
import type { EntryLite } from "../types";
import { liveEntries } from "./ledger";

/** Money out of the same amount within 7 days of another payment needs a second confirmation. */
export function findDuplicate(entries: EntryLite[], candidate: Pick<EntryLite, "direction" | "amount" | "date">): EntryLite | undefined {
  if (candidate.direction !== "out") return undefined;
  return liveEntries(entries).find((e) => e.direction === "out" && e.amount === candidate.amount && Math.abs(daysBetween(e.date, candidate.date)) <= 7);
}

export const duplicateWarning = (amount: number, dup: EntryLite) =>
  `Possible duplicate: you paid ${R(amount)} for "${dup.note ?? ""}" on ${shortDate(dup.date)}. Paying the same invoice twice is a common fraud. Press Save again if this is a new payment.`;

/** Money in uses stock; money out buys it. */
export const stockDelta = (direction: "in" | "out", qty: number) => (direction === "in" ? -qty : qty);

/** Restock tops up to twice the reorder level, at least one unit. */
export const restockQuantity = (qty: number, reorderAt: number) => Math.max(1, reorderAt * 2 - qty);

export const restockCost = (qty: number, reorderAt: number, cost: number) => Math.round(restockQuantity(qty, reorderAt) * cost);

/** Quantity can't go below zero. Two decimals, as stock can be in kg or litres. */
export const clampQty = (q: number) => Math.max(0, Math.round(q * 100) / 100);

export const cashPayoutCategory = (type: BusinessType) => (type === "recycling" ? "Collector payments" : "Other expense");

export const SLIP_PATTERN = /^S\d{5}$/;
