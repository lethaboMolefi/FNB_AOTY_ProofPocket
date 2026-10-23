// The five-step founder journey on Home: v2/app.js journey().
import { JOIN_DOCS } from "../constants";
import { R } from "../format";
import type { CompanySnapshot } from "../types";
import { cashOnHand, entriesThisMonth, lastEntryDays, liveEntries, monthTotals, recordMonths } from "./ledger";
import { isVerified } from "./verification";

export type JourneyView = "start" | "books" | "payments" | "cashflow" | "markets";
export interface JourneyStep { title: string; detail: string; done: boolean; view: JourneyView }

export function journey(s: CompanySnapshot, today: string): JourneyStep[] {
  const verified = isVerified(s.docs);
  const rm = recordMonths(s);
  const live = liveEntries(s.entries);
  return [
    { title: "Start", view: "start", done: verified,
      detail: verified ? "Verified business" : `${JOIN_DOCS.filter((k) => s.docs[k] === "verified").length} of 4 joining steps done` },
    { title: "Trade", view: "books", done: lastEntryDays(s.entries, today) <= 7,
      detail: `${entriesThisMonth(s.entries, today).length} entries this month` },
    { title: "Get paid", view: "payments", done: live.some((e) => e.direction === "in" && e.method !== "cash"),
      detail: `${s.paymentRequests.filter((r) => r.status === "waiting").length} payment requests open` },
    { title: "Manage cash flow", view: "cashflow", done: monthTotals(s.entries, today).profit >= 0 && !live.some((e) => e.isPersonal),
      detail: `${R(cashOnHand(s))} on hand` },
    { title: "Reach formal markets", view: "markets", done: rm >= 6 && verified,
      detail: rm >= 6 ? "6-month track record" : `${rm} of 6 months of track record` },
  ];
}
