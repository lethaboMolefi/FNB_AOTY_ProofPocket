// Reads CSV statements exported from South African banking apps (FNB, Capitec, Absa, Standard Bank, Nedbank,
// TymeBank and others). Columns are found by their headings; if that fails the founder picks them.
import Papa from "papaparse";
import type { StatementLine } from "@proofpocket/shared";

export const MAX_LINES = 2000;

export interface Mapping { date: number; description: number; amount?: number; moneyIn?: number; moneyOut?: number }
export type ParseResult =
  | { ok: true; lines: StatementLine[]; skipped: number; bank: string | null }
  | { ok: false; needsMapping: true; preview: string[][]; columnCount: number };

const H = {
  date: /^(transaction |trans\.? |posting |post |value |effective )?date$/i,
  description: /^(description|details|transaction details|narrative|transaction description|particulars|reference|transaction)$/i,
  amount: /^(amount|amount \(zar\)|amount \(r\)|transaction amount|value)$/i,
  moneyIn: /^(credit|credits|money in|deposit|deposits|credit amount|in)$/i,
  moneyOut: /^(debit|debits|money out|withdrawal|withdrawals|debit amount|out)$/i,
};

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** 2026-10-24, 2026/10/24, 20261024, 24/10/2026, 24-10-2026, 24 Oct 2026, 24 Oct 26. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, " ");
  let m = /^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})(?:[ T].*)?$/.exec(s);
  if (m) return valid(m[1]!, m[2]!, m[3]!);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return valid(m[3]!, m[2]!.padStart(2, "0"), m[1]!.padStart(2, "0"));
  m = /^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mon = MONTHS[m[2]!.toLowerCase()];
    if (!mon) return null;
    return valid(m[3]!.length === 2 ? `20${m[3]}` : m[3]!, mon, m[1]!.padStart(2, "0"));
  }
  return null;
}
function valid(y: string, mo: string, d: string) {
  const iso = `${y}-${mo}-${d}`;
  const t = new Date(iso + "T12:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null;
}

/** "-1 234,56", "1,234.56", "R 315.00", "100.00 CR", "(50.00)" → signed number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\u00a0/g, " ");
  if (!s) return null;
  let sign = 1;
  if (/\bDR\b$/i.test(s)) { sign = -1; s = s.replace(/\s*DR$/i, ""); }
  if (/\bCR\b$/i.test(s)) s = s.replace(/\s*CR$/i, "");
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1); }
  s = s.replace(/^R\s*/i, "").replace(/\s/g, "");
  if (s.startsWith("-")) { sign *= -1; s = s.slice(1); }
  if (s.startsWith("+")) s = s.slice(1);
  // Decimal comma ("1234,56" or "1.234,56").
  if (/,\d{2}$/.test(s) && !/\.\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return sign * Math.round(Number(s) * 100) / 100;
}

function findHeader(rows: string[][]): { at: number; map: Mapping } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i]!.map((c) => c.trim());
    const idx = (re: RegExp) => cells.findIndex((c) => re.test(c));
    const date = idx(H.date), description = idx(H.description), amount = idx(H.amount), moneyIn = idx(H.moneyIn), moneyOut = idx(H.moneyOut);
    if (date >= 0 && description >= 0 && (amount >= 0 || (moneyIn >= 0 && moneyOut >= 0))) {
      return { at: i, map: { date, description, ...(amount >= 0 ? { amount } : { moneyIn, moneyOut }) } };
    }
  }
  return null;
}

function guessBank(text: string): string | null {
  const head = text.slice(0, 2000).toUpperCase();
  for (const [name, re] of [["FNB", /\bFNB\b|FIRST NATIONAL BANK/], ["Capitec", /CAPITEC/], ["Absa", /\bABSA\b/], ["Standard Bank", /STANDARD BANK/], ["Nedbank", /NEDBANK/], ["TymeBank", /TYME/]] as const) {
    if (re.test(head)) return name;
  }
  return null;
}

export function parseStatement(text: string, mapping?: Mapping): ParseResult {
  const rows = (Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" }).data ?? []).filter((r) => Array.isArray(r));
  const found = mapping ? { at: -1, map: mapping } : findHeader(rows);
  if (!found) return { ok: false, needsMapping: true, preview: rows.slice(0, 6), columnCount: Math.max(0, ...rows.slice(0, 6).map((r) => r.length)) };
  const lines: StatementLine[] = [];
  let skipped = 0;
  for (const r of rows.slice(found.at + 1)) {
    const date = parseDate(r[found.map.date] ?? "");
    const description = (r[found.map.description] ?? "").trim().slice(0, 200);
    let signed: number | null;
    if (found.map.amount !== undefined) signed = parseAmount(r[found.map.amount] ?? "");
    else {
      const inn = parseAmount(r[found.map.moneyIn!] ?? ""), out = parseAmount(r[found.map.moneyOut!] ?? "");
      signed = inn ? Math.abs(inn) : out ? -Math.abs(out) : null;
    }
    // Balance lines, totals and headers repeated mid-file have no date or no amount.
    if (!date || !description || !signed) { skipped++; continue; }
    lines.push({ date, description, amount: Math.abs(signed), direction: signed > 0 ? "in" : "out" });
    if (lines.length >= MAX_LINES) break;
  }
  return { ok: true, lines, skipped, bank: guessBank(text) };
}

// ---------------------------------------------------------------- PDF statements
// Each transaction row starts with a date and ends with money amounts; the last is the running balance. Money in or out
// is read from how the balance moved (works whatever the bank's layout); Cr, Dr or a minus sign are used when there's no
// balance to go by.
const MONEY = /(?<![\d.,])-?(?:R\s?)?\d{1,3}(?:[ ,\u00a0]\d{3})*[.,]\d{2}(?:\s?(?:Cr|Dr|CR|DR))?(?![\d])/g;
const LEAD_DATE = /^(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2} [A-Za-z]{3,9} \d{4}|\d{1,2} [A-Za-z]{3,9})(?=\s)/;
const OPENING = /opening balance|balance brought forward|brought forward/i;

/** "1,200.00Cr" → 1200; "350.00" → 350 with no marker; "-500.00" or "500.00 Dr" → -500. */
function money(token: string): { value: number; marked: boolean } {
  const t = token.replace(/\s?(Cr|Dr|CR|DR)$/, (m) => ` ${m.trim()}`);
  const v = parseAmount(t) ?? 0;
  return { value: v, marked: /-|\bDR\b|\bCR\b/i.test(t) };
}

export function parsePdfStatement(lines: string[]): { lines: StatementLine[]; skipped: number; bank: string | null } {
  const text = lines.join("\n");
  const bank = guessBank(text);
  // Dates printed without a year (FNB) take the statement's year.
  const year = /\b(20\d{2})\b/.exec(text)?.[1] ?? todayYear();
  const out: StatementLine[] = [];
  let skipped = 0;
  let prev: number | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\u00a0/g, " ").trim();
    const tokens = [...line.matchAll(MONEY)];
    if (OPENING.test(line) && tokens.length) { prev = money(tokens.at(-1)![0]).value; continue; }
    const d = LEAD_DATE.exec(line);
    if (!d || !tokens.length) { if (d) skipped++; continue; }
    const date = parseDate(/[A-Za-z]{3,9}$/.test(d[1]!) ? `${d[1]} ${year}` : d[1]!);
    const description = line.slice(d[0].length, tokens[0]!.index).replace(/\s+/g, " ").trim().slice(0, 200);
    if (!date || !description) { skipped++; continue; }
    const amounts = tokens.map((t) => money(t[0]));
    let amount: number, inbound: boolean;
    if (amounts.length >= 2) {
      const balance = amounts.at(-1)!.value;
      const others = amounts.slice(0, -1);
      if (prev !== null) {
        const delta = Math.round((balance - prev) * 100) / 100;
        inbound = delta >= 0;
        amount = Math.abs((others.find((o) => Math.abs(o.value) === Math.abs(delta)) ?? others[0]!).value);
      } else {
        const first = others[0]!;
        inbound = first.marked ? first.value > 0 : bank !== "FNB";
        amount = Math.abs(first.value);
      }
      prev = balance;
    } else {
      const only = amounts[0]!;
      inbound = only.marked ? only.value > 0 : bank !== "FNB";
      amount = Math.abs(only.value);
    }
    if (!amount) { skipped++; continue; }
    out.push({ date, description, amount, direction: inbound ? "in" : "out" });
    if (out.length >= MAX_LINES) break;
  }
  return { lines: out, skipped, bank };
}

const todayYear = () => new Date().toISOString().slice(0, 4);
