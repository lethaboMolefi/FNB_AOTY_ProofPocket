// Getting paid. ProofPocket records payments and checks proofs; it never holds or moves money.
import { sql } from "drizzle-orm";
import { boolean, check, date, index, jsonb, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, isExample, messageKind, messageStatus, money, paymentStatus, proofStatus, rail, timestamps, watchStatus } from "./common";
import { companies, files, organisations, users } from "./core";
import { stockItems } from "./books";

/** One row per version; the latest row is the current set of details. */
export const paymentDetails = pgTable("payment_details", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  bank: text("bank").notNull().default(""),
  accountName: text("account_name").notNull().default(""),
  /** AES-256-GCM, encrypted by the API. Never logged. */
  accountNumberEnc: text("account_number_enc"),
  accountLast4: text("account_last4"),
  shapId: text("shap_id").notNull().default(""),
  inBusinessName: boolean("in_business_name"),
  changedBy: uuid("changed_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("payment_details_company_idx").on(t.companyId, t.createdAt)]);

export const paymentRequests = pgTable("payment_requests", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  /** What the client types as the payment reference, e.g. PP-4821. */
  ref: text("ref").notNull().unique(),
  /** Unguessable part of the public link /pay/{ref}-{token} (inventory 12.3). */
  publicToken: text("public_token").notNull().unique(),
  clientName: text("client_name").notNull(),
  amount: money("amount").notNull(),
  description: text("description").notNull().default(""),
  rails: rail("rails").array().notNull(),
  status: paymentStatus("status").notNull().default("waiting"),
  attempts: smallint("attempts").notNull().default(0),
  requestedOn: date("requested_on").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  index("payment_requests_company_idx").on(t.companyId, t.status),
  check("payment_requests_amount_positive", sql`${t.amount} > 0`),
  check("payment_requests_has_rail", sql`cardinality(${t.rails}) > 0`),
]);

export const paymentProofs = pgTable("payment_proofs", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  paymentRequestId: uuid("payment_request_id").notNull().references(() => paymentRequests.id, { onDelete: "cascade" }),
  payerName: text("payer_name").notNull(),
  amount: money("amount").notNull(),
  paidOn: date("paid_on").notNull(),
  method: rail("method").notNull(),
  usedReference: boolean("used_reference").notNull(),
  fileId: uuid("file_id").references(() => files.id),
  /** The five checks as shown to the founder: [{ code, ok, text }]. */
  checkResults: jsonb("check_results").notNull().default(sql`'[]'::jsonb`),
  status: proofStatus("status").notNull().default("submitted"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("payment_proofs_request_idx").on(t.paymentRequestId)]);

export const messages = pgTable("messages", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  kind: messageKind("kind").notNull(),
  sender: text("sender").notNull(),
  senderAddress: text("sender_address").notNull().default(""),
  senderOrgId: uuid("sender_org_id").references(() => organisations.id),
  verifiedSender: boolean("verified_sender").notNull().default(false),
  body: text("body").notNull(),
  riskFlags: text("risk_flags").array().notNull().default(sql`'{}'::text[]`),
  status: messageStatus("status").notNull().default("open"),
  paymentRequestId: uuid("payment_request_id").references(() => paymentRequests.id),
  receivedOn: date("received_on").notNull().default(sql`current_date`),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("messages_company_idx").on(t.companyId, t.status)]);

/** Senders founders reported as scams. Admin confirms or clears; other founders are warned (inventory 12.2). */
export const senderWatchlist = pgTable("sender_watchlist", {
  id: id(),
  /** Normalised email address or phone number. */
  senderKey: text("sender_key").notNull().unique(),
  reports: smallint("reports").notNull().default(1),
  status: watchStatus("status").notNull().default("watch"),
  lastReportedAt: timestamp("last_reported_at", { withTimezone: true }).notNull().defaultNow(),
  ...timestamps,
});

/** The stock lines a payment request was built from. Taken off stock once the money is confirmed. */
export const paymentRequestItems = pgTable("payment_request_items", {
  id: id(),
  paymentRequestId: uuid("payment_request_id").notNull().references(() => paymentRequests.id, { onDelete: "cascade" }),
  stockItemId: uuid("stock_item_id").notNull().references(() => stockItems.id),
  /** The item's name and price when the request was made (the client sees these). */
  name: text("name").notNull(),
  qty: money("qty").notNull(),
  unitPrice: money("unit_price").notNull(),
}, (t) => [index("payment_request_items_request_idx").on(t.paymentRequestId)]);
