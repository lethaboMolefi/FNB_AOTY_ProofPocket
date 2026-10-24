// Bank statement lines (inventory 12.5): avoid counting money twice when a statement is imported.
import { daysBetween } from "../dates";
import type { PayMethod } from "../constants";

export interface StatementLine { date: string; description: string; amount: number; direction: "in" | "out" }
export interface ExistingEntry { id: string; date: string; amount: number; direction: "in" | "out"; note: string }

const REF = /\bPP-\d{4,6}\b/i;

/**
 * An entry this line probably duplicates: a "PP-" payment reference already in the books, or the same
 * amount and direction within 3 days (e.g. a payment confirmed from a proof, then seen on the statement).
 */
export function matchExisting(line: StatementLine, entries: ExistingEntry[]): ExistingEntry | undefined {
  const ref = REF.exec(line.description)?.[0]?.toUpperCase();
  if (ref) {
    const byRef = entries.find((e) => e.direction === line.direction && e.note.toUpperCase().includes(ref));
    if (byRef) return byRef;
  }
  return entries.find((e) => e.direction === line.direction && Math.abs(e.amount - line.amount) < 0.005 && Math.abs(daysBetween(e.date, line.date)) <= 3);
}

/** A best guess at how a statement line was paid, from the bank's description (v2: inboxok). */
export function methodFromDescription(desc: string): PayMethod {
  if (/PAYSHAP|RTC|REAL.?TIME/i.test(desc)) return "payshap";
  if (/\bPOS\b|CARD|SPEEDPOINT|YOCO|IKHOKHA|ZAPPER|SNAPSCAN/i.test(desc)) return "card_machine";
  if (/\bATM\b|CASH/i.test(desc)) return "cash";
  return "eft";
}

/** Same line imported twice (same day, amount, direction and description). */
export const sameLine = (a: StatementLine, b: StatementLine) =>
  a.date === b.date && a.direction === b.direction && Math.abs(a.amount - b.amount) < 0.005 && a.description.trim().toUpperCase() === b.description.trim().toUpperCase();
