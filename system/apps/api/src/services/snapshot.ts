// Loads what the shared rules need (readiness, flags, journey, cash flow) for one or many companies.
import { docStatesFrom, flags, journey, readiness, recordMonths, series, type CompanySnapshot, type DocType } from "@proofpocket/shared";
import { sql } from "drizzle-orm";
import type { Tx } from "../db/client";

interface RawInputs {
  openingBalance: number | string;
  openingBalanceDate: string;
  docs: { docType: DocType; version: number; status: "pending" | "verified" | "rejected" | "expired" }[];
  entries: { date: string; direction: "in" | "out"; amount: number | string; category: string; method: CompanySnapshot["entries"][number]["method"]; isPersonal: boolean }[];
  history: { month: string; moneyIn: number | string; moneyOut: number | string }[];
  stock: { name: string; reorderAt: number | string; cost: number | string; qty: number | string }[];
  paymentRequests: CompanySnapshot["paymentRequests"];
  unverifiedOpenMessages: number | string;
  pendingSupplierChanges: number | string;
  offerChangedWithoutReason: boolean;
}

const n = (v: number | string) => Number(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Snapshots for the companies the caller may see (others are left out). */
export async function loadSnapshots(tx: Tx, ids: string[]): Promise<Map<string, CompanySnapshot>> {
  const out = new Map<string, CompanySnapshot>();
  if (!ids.length) return out;
  if (!ids.every((i) => UUID.test(i))) throw new Error("bad company id");
  // One Postgres array parameter: '{id,id,…}'::uuid[].
  const r = await tx.execute<{ company_id: string; inputs: RawInputs }>(sql`select * from company_rule_inputs(${`{${ids.join(",")}}`}::uuid[])`);
  for (const row of r.rows) {
    const i = row.inputs;
    out.set(row.company_id, {
      docs: docStatesFrom(i.docs),
      entries: i.entries.map((e) => ({ ...e, amount: n(e.amount) })),
      history: i.history.map((h) => ({ month: h.month, moneyIn: n(h.moneyIn), moneyOut: n(h.moneyOut) })),
      stock: i.stock.map((s) => ({ name: s.name, qty: n(s.qty), reorderAt: n(s.reorderAt), cost: n(s.cost) })),
      openingBalance: n(i.openingBalance),
      openingBalanceDate: i.openingBalanceDate,
      paymentRequests: i.paymentRequests,
      unverifiedOpenMessages: n(i.unverifiedOpenMessages),
      pendingSupplierChanges: n(i.pendingSupplierChanges),
      offerChangedWithoutReason: i.offerChangedWithoutReason,
    });
  }
  return out;
}

export async function loadSnapshot(tx: Tx, id: string) {
  const s = (await loadSnapshots(tx, [id])).get(id);
  if (!s) throw new Error("company not visible");
  return s;
}

/** The figures every portal shows about a company, computed on the server. */
export function summarise(s: CompanySnapshot, today: string) {
  const r = readiness(s, today);
  return { readiness: r, flags: flags(s, today), journey: journey(s, today), series: series(s, today), recordMonths: recordMonths(s) };
}
