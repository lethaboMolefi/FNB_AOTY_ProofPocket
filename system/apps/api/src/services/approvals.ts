// User approvals: the admin screens everyone who isn't a founder. Pending and rejected people are portal applications
// (no account yet, so they can't reach ProofPocket); approved people are accounts, which an admin can suspend and
// reinstate. Founders never appear here, and admins can't act on founders, other admins or themselves.
import { accountActionError, type Role } from "@proofpocket/shared";
import { eq, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { users } from "../db/schema/index";
import { audit, type Actor } from "../lib/audit";
import { decryptField } from "../lib/crypto";
import { AppError, notFound } from "../lib/errors";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export interface ApprovalFilters { q?: string; role?: "funder" | "adviser" | "buyer" | "admin"; status?: ApprovalStatus }

const like = (v: string) => "%" + v.replace(/[\\%_]/g, "\\$&") + "%";
const maskId = (id: string) => "•".repeat(Math.max(0, id.length - 3)) + id.slice(-3);
const APP_ROLE = { funder: "funder", support_org: "adviser" } as const;

const REFUSED = {
  not_admin: "Only an admin can do this.",
  self: "You can't change your own account here.",
  founder: "Founder accounts aren't managed here.",
  admin: "Admin accounts can't be changed by another admin.",
} as const;

export async function approvalsList(tx: Tx, me: { id: string }, f: ApprovalFilters) {
  const q = f.q ? like(f.q) : null;
  const apps = f.role === "buyer" || f.role === "admin" || f.status === "approved" || f.status === "suspended" ? [] : (await tx.execute<{
    id: string; kind: "funder" | "support_org"; status: "pending" | "rejected"; email: string; name: string; org: string; created_at: string;
  }>(sql`select id, kind, status::text as status, email, contact_name as name, org_name as org, created_at from portal_applications
    where status in ('pending', 'rejected')
      ${f.status ? sql`and status = ${f.status}::portal_application_status` : sql``}
      ${f.role ? sql`and kind = ${f.role === "funder" ? "funder" : "support_org"}::portal_application_kind` : sql``}
      ${q ? sql`and (email ilike ${q} or contact_name ilike ${q} or org_name ilike ${q})` : sql``}
    order by status <> 'pending', created_at`)).rows;
  const accounts = f.status === "pending" || f.status === "rejected" ? [] : (await tx.execute<{
    id: string; role: Role; email: string; name: string; org: string | null; created_at: string; suspended_at: string | null;
  }>(sql`select u.id, u.role::text as role, u.email, u.display_name as name, o.name as org, u.created_at, u.suspended_at
    from users u left join organisations o on o.id = u.org_id
    where u.role <> 'founder'
      ${f.role ? sql`and u.role = ${f.role}::user_role` : sql``}
      ${f.status === "approved" ? sql`and u.suspended_at is null` : f.status === "suspended" ? sql`and u.suspended_at is not null` : sql``}
      ${q ? sql`and (u.email ilike ${q} or u.display_name ilike ${q} or o.name ilike ${q})` : sql``}
    order by u.suspended_at is null, u.created_at desc`)).rows;
  return {
    items: [
      ...apps.map((a) => ({ type: "application" as const, id: a.id, name: a.name, email: a.email, role: APP_ROLE[a.kind] as Role, organisation: a.org, registeredAt: a.created_at, status: a.status as ApprovalStatus, canAct: a.status === "pending" })),
      ...accounts.map((u) => ({
        type: "user" as const, id: u.id, name: u.name, email: u.email, role: u.role, organisation: u.org, registeredAt: u.created_at,
        status: (u.suspended_at ? "suspended" : "approved") as ApprovalStatus, canAct: accountActionError({ id: me.id, role: "admin" }, { id: u.id, role: u.role }) === null,
      })),
    ],
  };
}

export async function approvalDetail(tx: Tx, config: Config, me: { id: string }, type: "application" | "user", id: string) {
  if (type === "application") {
    const [a] = (await tx.execute<{ id: string; kind: "funder" | "support_org"; status: string; email: string; contact_name: string; org_name: string; contact_id_number_enc: string; details: Record<string, unknown>; review_reason: string | null; created_at: string; reviewed_at: string | null }>(
      sql`select id, kind, status::text as status, email, contact_name, org_name, contact_id_number_enc, details, review_reason, created_at, reviewed_at from portal_applications where id = ${id}::uuid`)).rows;
    if (!a) throw notFound("That application");
    return {
      type, id: a.id, name: a.contact_name, email: a.email, role: APP_ROLE[a.kind], organisation: a.org_name, registeredAt: a.created_at,
      status: a.status, reason: a.review_reason, decidedAt: a.reviewed_at, canAct: a.status === "pending",
      // What they submitted. Only the last three digits of the ID number are shown.
      details: { ...a.details, idNumber: maskId(decryptField(a.contact_id_number_enc, config.ACCOUNT_NUMBER_KEY)) },
    };
  }
  const target = await accountFor(tx, id);
  const refused = accountActionError({ id: me.id, role: "admin" }, target);
  // Admins can't view founder accounts here at all; other admins (and themselves) are shown, read-only.
  if (refused === "founder") throw new AppError(403, "forbidden", REFUSED.founder);
  const [u] = (await tx.execute<{ id: string; email: string; name: string; role: Role; org: string | null; created_at: string; last_seen_at: string | null; suspended_at: string | null; suspended_reason: string | null; two_step: boolean }>(
    sql`select u.id, u.email, u.display_name as name, u.role::text as role, o.name as org, u.created_at, u.last_seen_at, u.suspended_at, u.suspended_reason,
      exists (select 1 from admin_two_factor_status() t where t.user_id = u.id and t.enabled) as two_step
      from users u left join organisations o on o.id = u.org_id where u.id = ${id}::uuid`)).rows;
  return {
    type, id: u!.id, name: u!.name, email: u!.email, role: u!.role, organisation: u!.org, registeredAt: u!.created_at, status: u!.suspended_at ? "suspended" : "approved",
    reason: u!.suspended_reason, decidedAt: u!.suspended_at, canAct: refused === null,
    details: { lastSeen: u!.last_seen_at, googleAuthenticator: u!.two_step ? "On" : "Not set up" },
  };
}

async function accountFor(tx: Tx, id: string) {
  const [t] = await tx.select({ id: users.id, role: users.role, email: users.email, displayName: users.displayName, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, id));
  if (!t) throw notFound("That account");
  return t;
}

/** Suspend (with a reason) or reinstate a funder, adviser or buyer account. Returns who to email. */
export async function setSuspended(tx: Tx, actor: Actor, id: string, suspend: { reason: string } | null) {
  const t = await accountFor(tx, id);
  const refused = accountActionError({ id: actor.userId ?? "", role: actor.role as Role }, t);
  if (refused) throw new AppError(403, "forbidden", REFUSED[refused]);
  if (suspend && t.suspendedAt) throw new AppError(409, "already_suspended", "This account is already suspended.");
  if (!suspend && !t.suspendedAt) throw new AppError(409, "not_suspended", "This account isn't suspended.");
  await tx.update(users).set(suspend ? { suspendedAt: new Date(), suspendedReason: suspend.reason } : { suspendedAt: null, suspendedReason: null }).where(eq(users.id, id));
  await audit(tx, actor, { action: suspend ? "user.suspended" : "user.reinstated", entity: "user", entityId: id, after: suspend ? { reason: suspend.reason } : {} });
  return { email: t.email, name: t.displayName, message: suspend ? `${t.displayName} is suspended.` : `${t.displayName} can use ProofPocket again.` };
}

/** What founders see: admins' account decisions without names, emails or reasons (POPIA). */
export async function founderAdminLog(tx: Tx) {
  const rows = (await tx.execute<{ at: string; action: string; role: string | null; organisation: string | null }>(sql`select * from founder_admin_log(100)`)).rows;
  const LABEL: Record<string, string> = { "portal_application.approved": "Approved", "portal_application.rejected": "Turned down", "user.suspended": "Suspended", "user.reinstated": "Reinstated" };
  return { entries: rows.map((r) => ({ at: r.at, action: LABEL[r.action] ?? r.action, role: r.role, organisation: r.organisation })) };
}
