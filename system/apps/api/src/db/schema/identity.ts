// Personal details collected when people join: founders' ID numbers and co-founders, and applications
// for a funder or support-organisation portal. ID numbers are AES-256-GCM encrypted by the API and never logged.
import { jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, timestamps } from "./common";
import { companies, organisations, users } from "./core";

/** The owner's ID number and phone. Kept apart from companies so no company query can return it by accident. */
export const founderIdentity = pgTable("founder_identity", {
  companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  idNumberEnc: text("id_number_enc").notNull(),
  phone: text("phone").notNull(),
  ...timestamps,
});

export const companyCofounders = pgTable("company_cofounders", {
  id: id(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  idNumberEnc: text("id_number_enc").notNull(),
  role: text("role").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  shareholding: smallint("shareholding"),
  ...timestamps,
});

export const portalApplicationKind = pgEnum("portal_application_kind", ["funder", "support_org"]);
export const portalApplicationStatus = pgEnum("portal_application_status", ["pending", "approved", "rejected"]);

/**
 * Someone asking for a funder or support-organisation portal. It grants nothing: only an admin's approval
 * creates the organisation and the user (with the role), linked to each other.
 */
export const portalApplications = pgTable("portal_applications", {
  id: id(),
  kind: portalApplicationKind("kind").notNull(),
  status: portalApplicationStatus("status").notNull().default("pending"),
  /** The sign-in that sent it. One application per sign-in. */
  firebaseUid: text("firebase_uid").notNull(),
  email: text("email").notNull(),
  contactName: text("contact_name").notNull(),
  orgName: text("org_name").notNull(),
  /** The contact person's ID number, encrypted. */
  contactIdNumberEnc: text("contact_id_number_enc").notNull(),
  /** Everything else from the form (no ID numbers). */
  details: jsonb("details").notNull(),
  reviewReason: text("review_reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  /** Set on approval. */
  orgId: uuid("org_id").references(() => organisations.id),
  userId: uuid("user_id").references(() => users.id),
  ...timestamps,
}, (t) => [uniqueIndex("portal_applications_uid_key").on(t.firebaseUid)]);
