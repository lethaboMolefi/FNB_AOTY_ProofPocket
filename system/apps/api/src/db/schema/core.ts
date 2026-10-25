// Organisations, users, companies, files, documents and the company timeline.
import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, check, date, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  area, businessType, docStatus, docType, filePurpose, funderSharing, id, isExample, membershipStatus, money, orgType, timestamps, userRole,
} from "./common";

export const organisations = pgTable("organisations", {
  id: id(),
  type: orgType("type").notNull(),
  name: text("name").notNull(),
  /** Funders: Grant, Loan, Equity or Blended. Buyers: e.g. Retail, Hotels and venues. */
  kind: text("kind"),
  verified: boolean("verified").notNull().default(false),
  setupDone: boolean("setup_done").notNull().default(false),
  /** Buyers: what they are looking for, and the sectors they buy from. */
  wants: text("wants"),
  sectors: text("sectors").array().notNull().default(sql`'{}'::text[]`),
  isExample: isExample(),
  ...timestamps,
});

export const users = pgTable("users", {
  id: id(),
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull(),
  orgId: uuid("org_id").references(() => organisations.id),
  /** Incubator lead adviser: may invite colleagues. */
  isLead: boolean("is_lead").notNull().default(false),
  /** auth_time of the sign-in that passed the Google Authenticator code. */
  otpVerifiedAuthTime: bigint("otp_verified_auth_time", { mode: "number" }),
  /** Last API request, kept to within 5 minutes (touch_last_seen), for the admin's People page. */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
  check("users_org_matches_role", sql`(${t.role} in ('founder', 'admin')) or ${t.orgId} is not null`),
]);

export const companies = pgTable("companies", {
  id: id(),
  ownerId: uuid("owner_id").notNull().unique().references(() => users.id),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  slug: text("slug").notNull().unique(),
  businessType: businessType("business_type").notNull(),
  sector: text("sector").notNull(),
  town: text("town").notNull(),
  province: text("province").notNull(),
  area: area("area").notNull(),
  cipcNumber: text("cipc_number"),
  stage: text("stage").notNull().default("Early"),
  employees: integer("employees").notNull().default(1),
  foundedYear: smallint("founded_year").notNull(),
  openingBalance: money("opening_balance").notNull().default("0"),
  openingBalanceDate: date("opening_balance_date").notNull(),
  funderSharing: funderSharing("funder_sharing").notNull().default("summary"),
  /** Set when the four joining documents are verified. Kept in sync by the documents service. */
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  /** The incubator the company is an active member of (history in incubator_memberships). */
  incubatorId: uuid("incubator_id").references(() => organisations.id),
  adviserId: uuid("adviser_id").references(() => users.id),
  supportStage: smallint("support_stage").notNull().default(0),
  /** Set when the founder finishes the Join wizard (consent given, documents sent for checking). */
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  /** The privacy notice version the founder agreed to (PRIVACY_NOTICE_VERSION in shared). */
  consentVersion: text("consent_version"),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  check("companies_support_stage_range", sql`${t.supportStage} between 0 and 4`),
  check("companies_cipc_format", sql`${t.cipcNumber} is null or ${t.cipcNumber} ~ '^[0-9]{4}/[0-9]{6}/[0-9]{2}$'`),
  index("companies_incubator_idx").on(t.incubatorId),
]);

export const incubatorMemberships = pgTable("incubator_memberships", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  incubatorId: uuid("incubator_id").notNull().references(() => organisations.id),
  status: membershipStatus("status").notNull().default("requested"),
  decidedBy: uuid("decided_by").references(() => users.id),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("memberships_company_idx").on(t.companyId)]);

/** Every stored object in the private bucket. Documents, receipts, proofs and statements point here. */
export const files = pgTable("files", {
  id: id(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  purpose: filePurpose("purpose").notNull(),
  bucketPath: text("bucket_path").notNull().unique(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  /** Hex SHA-256 computed by the API from the stored bytes. Null until the upload is registered. */
  sha256: text("sha256"),
  originalName: text("original_name").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  registeredAt: timestamp("registered_at", { withTimezone: true }),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  index("files_sha256_idx").on(t.sha256),
  check("files_size_limit", sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 5242880`),
]);

export const documents = pgTable("documents", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  docType: docType("doc_type").notNull(),
  status: docStatus("status").notNull().default("pending"),
  fileId: uuid("file_id").references(() => files.id),
  version: integer("version").notNull().default(1),
  expiresOn: date("expires_on"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectReason: text("reject_reason"),
  isExample: isExample(),
  ...timestamps,
}, (t) => [
  uniqueIndex("documents_company_type_version_key").on(t.companyId, t.docType, t.version),
  check("documents_reject_has_reason", sql`${t.status} <> 'rejected' or length(coalesce(${t.rejectReason}, '')) > 0`),
]);

export const activity = pgTable("activity", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  text: text("text").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  isExample: isExample(),
  ...timestamps,
}, (t) => [index("activity_company_idx").on(t.companyId, t.occurredAt)]);

/** Append-only. The app database role may insert and read, never update or delete. */
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  companyId: uuid("company_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  requestId: text("request_id"),
  /** Hash chain (set by a trigger, 0009): each row's hash covers its fields and the previous row's hash. */
  // The defaults only satisfy insert types; the trigger always sets all three.
  chainSeq: bigint("chain_seq", { mode: "number" }).notNull().default(0),
  prevHash: text("prev_hash").notNull().default(""),
  hash: text("hash").notNull().default(""),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (t) => [index("audit_entity_idx").on(t.entity, t.entityId), uniqueIndex("audit_chain_seq_key").on(t.chainSeq)]);

/** Rate-limit counters shared by every API instance. Only reached through rate_limit_hit() (0009). */
export const rateLimitHits = pgTable("rate_limit_hits", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
}, (t) => [index("rate_limit_reset_idx").on(t.resetAt)]);

/**
 * Google Authenticator (TOTP) two-step sign-in. One row per user, readable only by that user.
 * The secret is AES-256-GCM encrypted by the API.
 */
export const userTotp = pgTable("user_totp", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secretEnc: text("secret_enc").notNull(),
  /** Null until the first code is entered during set-up. */
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  /** Last time step accepted, so a code can't be used twice. */
  lastStep: bigint("last_step", { mode: "number" }).notNull().default(0),
  failedAttempts: smallint("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
});

/**
 * Email + password accounts for local development and tests only (AUTH_MODE=local).
 * Production uses Firebase Authentication; this table stays empty there.
 */
export const localCredentials = pgTable("local_credentials", {
  id: id(),
  email: text("email").notNull(),
  /** scrypt$N$r$p$salt$hash */
  passwordHash: text("password_hash").notNull(),
  failedAttempts: smallint("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  ...timestamps,
}, (t) => [uniqueIndex("local_credentials_email_key").on(sql`lower(${t.email})`)]);
