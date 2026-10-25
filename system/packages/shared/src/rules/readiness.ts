// Funding readiness score: v2/app.js readiness(), scoreClass(), scoreLabel(). Authoritative on the server.
import { DOCS, OWNER_SALARY, READINESS_DOCS, SCORE_PROGRESSING, SCORE_READY, type DocState, type DocType, type Tone } from "../constants";
import { plural } from "../format";
import type { CompanySnapshot } from "../types";
import { lastEntryDays, liveEntries, recordMonths } from "./ledger";

export interface ReadinessItem {
  group: "Documents" | "Bookkeeping";
  key: DocType | "books_recent" | "separate_money" | "owner_salary" | "six_months";
  label: string;
  pts: number;
  ok: boolean;
  state?: DocState;
  hint: string;
}

const docHint = (st: DocState) =>
  st === "pending" ? "Uploaded, being checked" : st === "expired" ? "Expired, upload a current one" : st === "missing" ? "Not uploaded yet" : "Verified";

export function readiness(s: Pick<CompanySnapshot, "docs" | "entries" | "history">, today: string) {
  const items: ReadinessItem[] = [];
  for (const k of READINESS_DOCS) {
    const st = s.docs[k];
    items.push({ group: "Documents", key: k, label: DOCS[k].name, pts: DOCS[k].pts, ok: st === "verified", state: st, hint: docHint(st) });
  }
  const last = lastEntryDays(s.entries, today);
  items.push({
    group: "Bookkeeping", key: "books_recent", label: "Books updated in the last 7 days", pts: 10, ok: last <= 7,
    hint: last === Infinity ? "No entries yet" : `Last entry ${last} ${plural(last, "day")} ago`,
  });
  const personal = liveEntries(s.entries).filter((e) => e.isPersonal).length;
  items.push({
    group: "Bookkeeping", key: "separate_money", label: "Personal and business money kept separate", pts: 10, ok: personal === 0,
    hint: personal ? `${personal} personal ${plural(personal, "purchase")} paid from the business` : "No personal spending found",
  });
  const paysSelf = liveEntries(s.entries).some((e) => e.category === OWNER_SALARY);
  items.push({
    group: "Bookkeeping", key: "owner_salary", label: "Owner pays themselves a set salary", pts: 5, ok: paysSelf,
    hint: paysSelf ? "Owner salary recorded" : "Funders read a set owner salary as a sign of professionalism",
  });
  const rm = recordMonths(s);
  items.push({ group: "Bookkeeping", key: "six_months", label: "Six months of records", pts: 5, ok: rm >= 6, hint: `${rm} ${plural(rm, "month")} on record` });
  return { score: items.reduce((a, i) => a + (i.ok ? i.pts : 0), 0), items };
}

export const scoreTone = (score: number): Tone => (score >= SCORE_READY ? "good" : score >= SCORE_PROGRESSING ? "warn" : "bad");
export const scoreLabel = (score: number) => (score >= SCORE_READY ? "Funding ready" : score >= SCORE_PROGRESSING ? "Getting there" : "Early");

/** Home "Next steps": the four unmet items worth the most points. */
export const nextSteps = (items: ReadinessItem[]) => items.filter((i) => !i.ok).sort((a, b) => b.pts - a.pts).slice(0, 4);
