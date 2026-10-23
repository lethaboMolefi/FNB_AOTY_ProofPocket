// Bookkeeping, stock, suppliers and bank statement imports.
import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { changeStatus, direction, entrySource, id, isExample, money, payMethod, statementLineStatus, timestamps } from "./common";
import { companies, files, users } from "./core";

export const stockItems = pgTable("stock_items", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("units"),
  reorderAt: money("reorder_at").notNull().default("0"),
  cost: money("cost").notNull().default("0"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
});

export const suppliers = pgTable("suppliers", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Masked only, e.g. "FNB ••4821". ProofPocket never pays suppliers, so it never needs full numbers. */
  bankMasked: text("bank_masked").notNull(),
  pendingBankMasked: text("pending_bank_masked"),
  pendingSince: date("pending_since"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
});

export const supplierBankChanges = pgTable("supplier_bank_changes", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  fromMasked: text("from_masked").notNull(),
  toMasked: text("to_masked").notNull(),
  status: changeStatus("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").references(() => users.id),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
});

export const statementImports = pgTable("statement_imports", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").references(() => files.id),
  bank: text("bank"),
  format: text("format").notNull(),
  lineCount: integer("line_count").notNull().default(0),
  importedBy: uuid("imported_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  /** Generated on the phone so an entry synced twice from the offline outbox is stored once. */
  clientUuid: uuid("client_uuid").notNull().unique(),
  entryDate: date("entry_date").notNull(),
  direction: direction("direction").notNull(),
  amount: money("amount").notNull(),
  method: payMethod("method").notNull(),
  category: text("category").notNull(),
  note: text("note").notNull().default(""),
  isPersonal: boolean("is_personal").notNull().default(false),
  paidBackAt: timestamp("paid_back_at", { withTimezone: true }),
  receiptFileId: uuid("receipt_file_id").references(() => files.id),
  /** Seed and statement entries count as "receipt kept" without a stored photo, as in the prototype. */
  receiptKept: boolean("receipt_kept").notNull().default(false),
  stockItemId: uuid("stock_item_id").references(() => stockItems.id),
  qty: money("qty"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  paymentRequestId: uuid("payment_request_id"),
  paymentProofId: uuid("payment_proof_id"),
  statementLineId: uuid("statement_line_id"),
  slipNumber: text("slip_number"),
  source: entrySource("source").notNull().default("manual"),
  /** Entries are never deleted: a correction voids the old entry and adds a new one. */
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdBy: uuid("created_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  index("ledger_company_date_idx").on(t.companyId, t.entryDate),
  uniqueIndex("ledger_company_slip_key").on(t.companyId, t.slipNumber).where(sql`${t.slipNumber} is not null`),
  check("ledger_amount_positive", sql`${t.amount} > 0`),
  check("ledger_personal_is_out", sql`not ${t.isPersonal} or ${t.direction} = 'out'`),
  check("ledger_void_has_reason", sql`${t.voidedAt} is null or length(coalesce(${t.voidReason}, '')) > 0`),
]);

export const stockMovements = pgTable("stock_movements", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  stockItemId: uuid("stock_item_id").notNull().references(() => stockItems.id, { onDelete: "cascade" }),
  clientUuid: uuid("client_uuid").notNull().unique(),
  /** Quantity in stock = sum of deltas, so offline changes from two phones add up instead of overwriting. */
  delta: money("delta").notNull(),
  reason: text("reason").notNull(),
  ledgerEntryId: uuid("ledger_entry_id").references(() => ledgerEntries.id),
  createdBy: uuid("created_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("stock_movements_item_idx").on(t.stockItemId)]);

export const statementLines = pgTable("statement_lines", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  importId: uuid("import_id").notNull().references(() => statementImports.id, { onDelete: "cascade" }),
  lineDate: date("line_date").notNull(),
  description: text("description").notNull(),
  amount: money("amount").notNull(),
  direction: direction("direction").notNull(),
  status: statementLineStatus("status").notNull().default("unsorted"),
  /** An existing entry this line appears to duplicate (e.g. a payment already confirmed from a proof). */
  matchedEntryId: uuid("matched_entry_id").references(() => ledgerEntries.id),
  ledgerEntryId: uuid("ledger_entry_id").references(() => ledgerEntries.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("statement_lines_company_idx").on(t.companyId, t.status)]);

/** Earlier months the founder typed in or imported. Shown as self-reported, not checked books. */
export const monthlyHistory = pgTable("monthly_history", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  month: date("month").notNull(),
  moneyIn: money("money_in").notNull().default("0"),
  moneyOut: money("money_out").notNull().default("0"),
  source: text("source").notNull().default("self_reported"),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  uniqueIndex("monthly_history_company_month_key").on(t.companyId, t.month),
  check("monthly_history_first_of_month", sql`extract(day from ${t.month}) = 1`),
]);
