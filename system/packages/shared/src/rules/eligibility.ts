// Programme gaps (v2/app.js progCheck), applying, tenders, funder visibility.
import { DOCS, type DocType, type FunderSharing } from "../constants";
import { R } from "../format";
import type { DocStates } from "../types";
import { isVerified, missingFor } from "./verification";

export interface EligibilityInput {
  docs: DocStates;
  recordMonths: number;
  score: number;
}

export interface ProgrammeRules {
  requiredDocs: DocType[];
  minMonths: number;
  minScore: number;
  minAmount: number;
  maxAmount: number;
}

/** What a company still needs for a programme, in the prototype's order. Empty = qualifies. */
export function programmeGaps(c: EligibilityInput, p: Pick<ProgrammeRules, "requiredDocs" | "minMonths" | "minScore">): string[] {
  const gaps: string[] = missingFor(c.docs, p.requiredDocs).map((k) => DOCS[k].short);
  if (c.recordMonths < (p.minMonths || 0)) gaps.push(`${p.minMonths} months of records (you have ${c.recordMonths})`);
  if (c.score < (p.minScore || 0)) gaps.push(`score ${p.minScore}+ (you have ${c.score})`);
  if (!isVerified(c.docs)) gaps.unshift("Verified account");
  return gaps;
}

export type ApplyCheck = { ok: true } | { ok: false; code: "gaps" | "amount" | "already_applied"; message: string };

export function canApply(c: EligibilityInput, p: ProgrammeRules, amount: number, alreadyApplied: boolean): ApplyCheck {
  if (alreadyApplied) return { ok: false, code: "already_applied", message: "You've already applied to this programme." };
  const gaps = programmeGaps(c, p);
  if (gaps.length) return { ok: false, code: "gaps", message: `Still needed: ${gaps.join(", ")}.` };
  if (!(amount >= p.minAmount && amount <= p.maxAmount)) return { ok: false, code: "amount", message: `Enter an amount between ${R(p.minAmount)} and ${R(p.maxAmount)}` };
  return { ok: true };
}

/** Funders' pipeline shows only Verified companies that share at least a summary. */
export const funderVisible = (c: { docs: DocStates; sharing: FunderSharing }) => isVerified(c.docs) && c.sharing !== "none";

/** Individual book entries are shown only with full sharing (advisers always see them). */
export const funderSeesEntries = (sharing: FunderSharing) => sharing === "full";

export interface TenderRules { requiredDocs: DocType[]; minMonths: number; sectors: string[] }

export type TenderAction =
  | { kind: "verify_first" }
  | { kind: "add_documents"; missing: DocType[] }
  | { kind: "more_months"; months: number }
  | { kind: "can_express" };

/** What the founder can do about a tender (v2/app.js vProcurement). */
export function tenderAction(c: EligibilityInput, t: TenderRules): TenderAction {
  if (!isVerified(c.docs)) return { kind: "verify_first" };
  const missing = missingFor(c.docs, t.requiredDocs);
  if (missing.length) return { kind: "add_documents", missing };
  if (c.recordMonths < t.minMonths) return { kind: "more_months", months: t.minMonths - c.recordMonths };
  return { kind: "can_express" };
}

export const sectorMatch = (sector: string, sectors: string[]) => sectors.includes(sector);
