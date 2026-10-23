// Profile, posts, funding, incubator support, tenders, buyers and reports.
import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { applicationStatus, docType, featureStatus, handledStatus, id, isExample, money, programmeStatus, reportStatus, reportTarget, timestamps } from "./common";
import { companies, organisations, users } from "./core";

export const profiles = pgTable("profiles", {
  companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  tagline: text("tagline").notNull().default(""),
  services: text("services").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  hours: text("hours").notNull().default(""),
  isExample: isExample(),
  ...timestamps,
}, (t) => [check("profiles_tagline_length", sql`length(${t.tagline}) <= 90`)]);

export const posts = pgTable("posts", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  postedOn: date("posted_on").notNull().default(sql`current_date`),
  sharedTo: text("shared_to").array().notNull().default(sql`'{}'::text[]`),
  feature: featureStatus("feature").notNull().default("none"),
  featuredUntil: date("featured_until"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
}, (t) => [check("posts_text_length", sql`length(${t.text}) between 1 and 400`)]);

export const programmes = pgTable("programmes", {
  id: id(),
  funderId: uuid("funder_id").notNull().references(() => organisations.id),
  name: text("name").notNull(),
  minAmount: money("min_amount").notNull(),
  maxAmount: money("max_amount").notNull(),
  budget: money("budget").notNull().default("0"),
  committed: money("committed").notNull().default("0"),
  minMonths: smallint("min_months").notNull().default(0),
  minScore: smallint("min_score").notNull().default(0),
  status: programmeStatus("status").notNull().default("open"),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  check("programmes_amount_range", sql`${t.minAmount} <= ${t.maxAmount}`),
  check("programmes_score_range", sql`${t.minScore} between 0 and 100`),
]);

export const programmeRequirements = pgTable("programme_requirements", {
  programmeId: uuid("programme_id").notNull().references(() => programmes.id, { onDelete: "cascade" }),
  docType: docType("doc_type").notNull(),
  ...timestamps,
}, (t) => [primaryKey({ columns: [t.programmeId, t.docType] })]);

export const applications = pgTable("applications", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  programmeId: uuid("programme_id").notNull().references(() => programmes.id),
  funderId: uuid("funder_id").notNull().references(() => organisations.id),
  requestedAmount: money("requested_amount").notNull(),
  status: applicationStatus("status").notNull().default("submitted"),
  statusReason: text("status_reason").notNull().default(""),
  reasonRequested: boolean("reason_requested").notNull().default(false),
  appliedOn: date("applied_on").notNull().default(sql`current_date`),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  uniqueIndex("applications_company_programme_key").on(t.companyId, t.programmeId),
  index("applications_funder_idx").on(t.funderId),
  check("applications_decline_has_reason", sql`${t.status} <> 'declined' or length(${t.statusReason}) > 0`),
]);

export const offers = pgTable("offers", {
  id: id(),
  applicationId: uuid("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  amount: money("amount").notNull(),
  /** Required for every change after the first offer. Seed data keeps one empty reason (the R28 000 cut). */
  reason: text("reason").notNull().default(""),
  changedBy: uuid("changed_by").references(() => users.id),
  offeredOn: date("offered_on").notNull().default(sql`current_date`),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("offers_application_idx").on(t.applicationId, t.createdAt)]);

export const supportLogs = pgTable("support_logs", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  incubatorId: uuid("incubator_id").notNull().references(() => organisations.id),
  adviserId: uuid("adviser_id").references(() => users.id),
  supportType: text("support_type").notNull(),
  note: text("note").notNull(),
  logDate: date("log_date").notNull().default(sql`current_date`),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("support_logs_company_idx").on(t.companyId)]);

export const tenders = pgTable("tenders", {
  id: id(),
  title: text("title").notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerOrgId: uuid("buyer_org_id").references(() => organisations.id),
  value: money("value").notNull(),
  closesOn: date("closes_on").notNull(),
  minMonths: smallint("min_months").notNull().default(0),
  sectors: text("sectors").array().notNull().default(sql`'{}'::text[]`),
  isExample: isExample(),
  ...timestamps,
});

export const tenderRequirements = pgTable("tender_requirements", {
  tenderId: uuid("tender_id").notNull().references(() => tenders.id, { onDelete: "cascade" }),
  docType: docType("doc_type").notNull(),
  ...timestamps,
}, (t) => [primaryKey({ columns: [t.tenderId, t.docType] })]);

export const tenderInterests = pgTable("tender_interests", {
  id: id(),
  tenderId: uuid("tender_id").notNull().references(() => tenders.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  status: handledStatus("status").notNull().default("requested"),
  handledBy: uuid("handled_by").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [uniqueIndex("tender_interests_key").on(t.tenderId, t.companyId)]);

export const introRequests = pgTable("intro_requests", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  buyerId: uuid("buyer_id").notNull().references(() => organisations.id),
  status: handledStatus("status").notNull().default("requested"),
  handledBy: uuid("handled_by").references(() => users.id),
  note: text("note"),
  isExample: isExample(),
  ...timestamps,
}, (t) => [uniqueIndex("intro_requests_key").on(t.companyId, t.buyerId)]);

export const reports = pgTable("reports", {
  id: id(),
  targetType: reportTarget("target_type").notNull(),
  targetId: text("target_id").notNull(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  reason: text("reason").notNull().default(""),
  reporterUserId: uuid("reporter_user_id").references(() => users.id),
  status: reportStatus("status").notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  resolutionNote: text("resolution_note"),
  ...timestamps,
}, (t) => [index("reports_status_idx").on(t.status)]);

