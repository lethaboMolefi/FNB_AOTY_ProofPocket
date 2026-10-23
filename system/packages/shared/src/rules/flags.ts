// Things to watch: v2/app.js flags(). Order and wording are kept from the prototype.
import { DOCS, DOC_TYPES } from "../constants";
import { plural } from "../format";
import type { CompanySnapshot } from "../types";
import { lastEntryDays, liveEntries, lowStock, series } from "./ledger";
import { isVerified } from "./verification";

export interface Flag {
  level: "warn" | "bad";
  code: string;
  text: string;
}

export const STARTER_FLAG = "starter";

export function flags(s: CompanySnapshot, today: string): Flag[] {
  const f: Flag[] = [];
  if (!isVerified(s.docs)) f.push({ level: "warn", code: STARTER_FLAG, text: "Starter account, not yet verified" });
  for (const k of DOC_TYPES) if (s.docs[k] === "expired") f.push({ level: "bad", code: `expired_${k}`, text: `${DOCS[k].name} expired` });
  const pend = DOC_TYPES.filter((k) => s.docs[k] === "pending").length;
  if (pend) f.push({ level: "warn", code: "docs_waiting", text: `${pend} ${plural(pend, "document")} waiting for a check` });
  const last = lastEntryDays(s.entries, today);
  if (last > 14) f.push({ level: "bad", code: "books_stale", text: last === Infinity ? "No bookkeeping entries" : `Books not updated for ${last} days` });
  if (liveEntries(s.entries).some((e) => e.isPersonal)) f.push({ level: "warn", code: "personal_spending", text: "Personal spending from business money" });
  // Compare last month's income with the month before (the prototype's months[3] and months[4]).
  const sr = series(s, today);
  const a = sr[3]!.moneyIn, b = sr[4]!.moneyIn;
  if (a > 0 && (a - b) / a > 0.2) f.push({ level: "warn", code: "income_fell", text: `Income fell ${Math.round(((a - b) / a) * 100)}% last month` });
  const pc = s.paymentRequests.filter((r) => r.status === "checking").length;
  if (pc) f.push({ level: "warn", code: "proofs_to_check", text: `${pc} ${plural(pc, "proof")} of payment to check` });
  const ls = lowStock(s.stock).length;
  if (ls) f.push({ level: "warn", code: "low_stock", text: `${ls} stock ${plural(ls, "item")} running low` });
  const scam = s.unverifiedOpenMessages + s.pendingSupplierChanges;
  if (scam) f.push({ level: "bad", code: "fraud_open", text: `${scam} fraud ${plural(scam, "warning")} open` });
  if (s.offerChangedWithoutReason) f.push({ level: "warn", code: "offer_no_reason", text: "Funding offer changed with no reason given" });
  return f;
}

/** Most urgent first, as on the incubator's Needs attention page. */
export const byUrgency = <T extends { level: Flag["level"] }>(list: T[]) =>
  [...list].sort((x, y) => (x.level === "bad" ? -1 : 1) - (y.level === "bad" ? -1 : 1));

/** Fraud warnings open = unverified open messages + supplier bank changes on hold. */
export const fraudOpen = (s: Pick<CompanySnapshot, "unverifiedOpenMessages" | "pendingSupplierChanges">) =>
  s.unverifiedOpenMessages + s.pendingSupplierChanges;
