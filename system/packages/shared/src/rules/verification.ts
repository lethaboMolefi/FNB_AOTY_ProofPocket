// Starter and Verified accounts: v2/app.js isVerified, JOIN_DOCS, routeCheck, approveDoc.
import { DOC_TYPES, JOIN_DOCS, STARTER_DOCS, type DocState, type DocType } from "../constants";
import type { DocStates } from "../types";

/** Verified = CIPC, owner ID, bank confirmation and address all verified. */
export const isVerified = (docs: DocStates) => JOIN_DOCS.every((k) => docs[k] === "verified");

/** Documents asked for at Join: four if registered with CIPC, otherwise ID and address. */
export const joinDocsFor = (registeredWithCipc: boolean): DocType[] => (registeredWithCipc ? JOIN_DOCS : STARTER_DOCS);

/** Who checks a company's uploads: its incubator's adviser, or the ProofPocket admin checker. */
export const checkerFor = (company: { incubatorId: string | null }): "adviser" | "admin" =>
  company.incubatorId ? "adviser" : "admin";

/** True when approving `doc` is the step that turns a Starter into a Verified company. */
export function becomesVerified(docs: DocStates, doc: DocType): boolean {
  if (isVerified(docs)) return false;
  return isVerified({ ...docs, [doc]: "verified" });
}

/** Founders can upload when a document is missing or expired; not while it is being checked or verified. */
export const canUpload = (state: DocState) => state === "missing" || state === "expired";

export const verifiedCount = (docs: DocStates) => DOC_TYPES.filter((k) => docs[k] === "verified").length;

export const missingFor = (docs: DocStates, required: DocType[]) => required.filter((k) => docs[k] !== "verified");

export function emptyDocStates(): DocStates {
  return Object.fromEntries(DOC_TYPES.map((k) => [k, "missing"])) as DocStates;
}

/**
 * Current state of each document type from its uploads (latest version wins).
 * A rejected upload means the founder must upload again, so it reads as missing.
 */
export function docStatesFrom(uploads: { docType: DocType; version: number; status: "pending" | "verified" | "rejected" | "expired" }[]): DocStates {
  const states = emptyDocStates();
  const latest = new Map<DocType, { version: number; status: string }>();
  for (const u of uploads) {
    const cur = latest.get(u.docType);
    if (!cur || u.version > cur.version) latest.set(u.docType, u);
  }
  for (const [k, u] of latest) states[k] = u.status === "rejected" ? "missing" : (u.status as DocState);
  return states;
}
