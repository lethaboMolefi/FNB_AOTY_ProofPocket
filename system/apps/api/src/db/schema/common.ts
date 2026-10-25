import { boolean, numeric, pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};
/** Rand, numeric(12,2). Drizzle returns these as strings; repositories convert to numbers. */
export const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
/** Rows created by the seed are marked so they can be shown and removed as example data. */
export const isExample = () => boolean("is_example").notNull().default(false);

export const orgType = pgEnum("org_type", ["funder", "incubator", "buyer"]);
export const userRole = pgEnum("user_role", ["founder", "funder", "adviser", "buyer", "admin"]);
export const businessType = pgEnum("business_type", ["beauty", "food", "retail", "recycling", "trades", "services"]);
export const area = pgEnum("area", ["township", "urban", "rural"]);
export const funderSharing = pgEnum("funder_sharing", ["none", "summary", "full"]);
export const docType = pgEnum("doc_type", ["cipc", "id", "bank", "addr", "tax", "bplan", "fin", "bbbee", "csd"]);
/** Per upload. A company's "missing" state is derived: no upload, or the latest was sent back (rejected). */
export const docStatus = pgEnum("doc_status", ["pending", "verified", "rejected", "expired"]);
export const direction = pgEnum("direction", ["in", "out"]);
export const payMethod = pgEnum("pay_method", ["cash", "card_machine", "eft", "payshap", "wallet"]);
export const rail = pgEnum("rail", ["payshap", "eft", "cash", "card_machine"]);
export const entrySource = pgEnum("entry_source", ["manual", "statement", "proof", "cash_request", "restock", "supplier_payment", "cash_payout", "seed"]);
export const statementLineStatus = pgEnum("statement_line_status", ["unsorted", "added", "personal", "skipped", "already_in_books"]);
export const paymentStatus = pgEnum("payment_status", ["waiting", "checking", "paid", "not_received", "flagged", "expired", "cancelled"]);
export const proofStatus = pgEnum("proof_status", ["submitted", "confirmed", "rejected"]);
export const changeStatus = pgEnum("change_status", ["pending", "confirmed", "rejected"]);
export const featureStatus = pgEnum("feature_status", ["none", "requested", "featured", "rejected"]);
export const messageKind = pgEnum("message_kind", ["system", "organisation", "client_flag", "checked_by_founder"]);
export const messageStatus = pgEnum("message_status", ["open", "blocked", "safe"]);
export const programmeStatus = pgEnum("programme_status", ["open", "closed"]);
export const applicationStatus = pgEnum("application_status", ["submitted", "under_review", "offer_made", "awaiting_cofunding", "approved", "declined", "withdrawn"]);
export const membershipStatus = pgEnum("membership_status", ["requested", "active", "left", "declined"]);
export const handledStatus = pgEnum("handled_status", ["requested", "arranged", "declined"]);
export const reportTarget = pgEnum("report_target", ["company", "payment_request", "post", "message_sender", "data_request"]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);
export const filePurpose = pgEnum("file_purpose", ["document", "receipt", "proof", "statement"]);
export const watchStatus = pgEnum("watch_status", ["watch", "confirmed_scam", "cleared"]);
