// Applications for a funder or support-organisation portal. Sending one grants nothing; an admin's approval
// creates the organisation and the user with the role, linked to each other. ID numbers are encrypted and never logged.
import { ALL_SECTORS, maskId, type InvestorDetails, type OrgOnboard, type PortalApplicationInput } from "@proofpocket/shared";
import { asc, eq, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { organisations, portalApplications, users } from "../db/schema/index";
import { audit, type Actor } from "../lib/audit";
import { decryptField, encryptField } from "../lib/crypto";
import { AppError, badRequest, notFound } from "../lib/errors";

const KIND_LABEL = { funder: "funder portal", support_org: "support organisation portal" } as const;

const emailTaken = async (tx: Tx, email: string) =>
  (await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`)).length > 0;

/** Sent by a signed-in person with no ProofPocket account yet (database role 'joining'). */
export async function submitApplication(tx: Tx, config: Config, who: { firebaseUid: string; email: string }, a: PortalApplicationInput) {
  const [existing] = await tx.select({ status: portalApplications.status }).from(portalApplications).where(eq(portalApplications.firebaseUid, who.firebaseUid));
  if (existing) throw new AppError(409, "already_applied", "You've already sent an application with this account.");
  if (await emailTaken(tx, who.email)) throw new AppError(409, "email_taken", "Someone with this email already has a ProofPocket account. Sign in instead.");
  const { contactName, idNumber, rest } = a.kind === "funder"
    ? (({ repName, repIdNumber, ...r }: InvestorDetails) => ({ contactName: repName, idNumber: repIdNumber, rest: r }))(a.details)
    : (({ contactName: n, contactIdNumber, ...r }: OrgOnboard) => ({ contactName: n, idNumber: contactIdNumber, rest: r }))(a.details);
  const [row] = await tx.insert(portalApplications).values({
    kind: a.kind, firebaseUid: who.firebaseUid, email: who.email, contactName, orgName: a.details.orgName,
    contactIdNumberEnc: encryptField(idNumber, config.ACCOUNT_NUMBER_KEY), details: rest,
  }).returning({ id: portalApplications.id });
  // No ID number in the audit log.
  await audit(tx, { userId: null, role: "joining", requestId: "" }, { action: "portal_application.sent", entity: "portal_application", entityId: row!.id, after: { kind: a.kind, orgName: a.details.orgName, email: who.email } });
  return { message: `Application sent. We'll email ${who.email} once it has been checked, usually within 2–3 business days.` };
}

/** The applicant's own application, if they sent one. */
export async function myApplication(tx: Tx, firebaseUid: string) {
  const [a] = await tx.select().from(portalApplications).where(eq(portalApplications.firebaseUid, firebaseUid));
  return { application: a ? { kind: a.kind, orgName: a.orgName, status: a.status, reason: a.reviewReason, sentOn: a.createdAt } : null };
}

/** The admin queue: pending first. Only the last three digits of the ID number are shown. */
export async function applicationsView(tx: Tx, config: Config) {
  const rows = await tx.select().from(portalApplications).orderBy(sql`${portalApplications.status} <> 'pending'`, asc(portalApplications.createdAt));
  return {
    applications: rows.map((a) => ({
      id: a.id, kind: a.kind, status: a.status, email: a.email, contactName: a.contactName, orgName: a.orgName,
      idNumber: maskId(decryptField(a.contactIdNumberEnc, config.ACCOUNT_NUMBER_KEY)),
      details: a.details as Record<string, unknown>, reason: a.reviewReason, sentOn: a.createdAt, reviewedOn: a.reviewedAt,
    })),
  };
}

/** Funders on ProofPocket are Grant, Loan, Equity or Blended. */
function funderKind(instruments: string[]) {
  const kinds = [...new Set(instruments.map((i) => ({ grant: "Grant", debt: "Loan", equity: "Equity", convertible: "Equity" } as Record<string, string>)[i] ?? "Blended"))];
  return kinds.length === 1 ? kinds[0]! : "Blended";
}

export async function decideApplication(tx: Tx, actor: Actor, id: string, d: { decision: "approve" } | { decision: "reject"; reason: string }) {
  const [a] = await tx.select().from(portalApplications).where(eq(portalApplications.id, id));
  if (!a) throw notFound("That application");
  if (a.status !== "pending") throw badRequest("already_decided", `This application was already ${a.status}.`);
  const reviewed = { reviewedBy: actor.userId, reviewedAt: new Date() };

  if (d.decision === "reject") {
    await tx.update(portalApplications).set({ status: "rejected", reviewReason: d.reason, ...reviewed }).where(eq(portalApplications.id, id));
    await audit(tx, actor, { action: "portal_application.rejected", entity: "portal_application", entityId: id, after: { reason: d.reason } });
    return { message: `${a.orgName} was turned down. They've been told why.`, email: a.email, kind: a.kind, orgName: a.orgName, approved: false as const, reason: d.reason };
  }

  if (await emailTaken(tx, a.email)) throw badRequest("email_taken", "Someone with this email already has a ProofPocket account.");
  const det = a.details as Record<string, unknown>;
  const funder = a.kind === "funder";
  const [org] = await tx.insert(organisations).values({
    type: funder ? "funder" : "incubator", name: a.orgName, verified: true,
    // A new funder sets its requirements before seeing the pipeline.
    setupDone: !funder,
    kind: funder ? funderKind((det.instruments as string[]) ?? []) : String(det.orgType ?? ""),
    sectors: ((det.sectors as string[]) ?? []).filter((s) => ALL_SECTORS.includes(s)),
  }).returning({ id: organisations.id });
  const [u] = await tx.insert(users).values({
    firebaseUid: a.firebaseUid, email: a.email, displayName: a.contactName,
    role: funder ? "funder" : "adviser", orgId: org!.id, isLead: !funder,
  }).returning({ id: users.id });
  await tx.update(portalApplications).set({ status: "approved", orgId: org!.id, userId: u!.id, ...reviewed }).where(eq(portalApplications.id, id));
  await audit(tx, actor, { action: "portal_application.approved", entity: "portal_application", entityId: id, after: { orgId: org!.id, userId: u!.id, role: funder ? "funder" : "adviser" } });
  return { message: `${a.orgName} approved. ${a.contactName} can now sign in to the ${KIND_LABEL[a.kind]}.`, email: a.email, kind: a.kind, orgName: a.orgName, approved: true as const };
}
