// Account screening by admins, and temporary passwords for accounts made by an operator.
import type { Role } from "../constants";

/** Temporary passwords stop working after this many days. */
export const TEMP_PASSWORD_DAYS = 7;

/**
 * Whether an admin may approve, reject, suspend or reinstate this account. Admins screen funders, advisers and
 * buyers; never founders, other admins or themselves. null means allowed; otherwise why not.
 */
export function accountActionError(actor: { id: string; role: Role }, target: { id: string; role: Role }): "not_admin" | "self" | "founder" | "admin" | null {
  if (actor.role !== "admin") return "not_admin";
  if (actor.id === target.id) return "self";
  if (target.role === "founder") return "founder";
  if (target.role === "admin") return "admin";
  return null;
}

/** ok: nothing to do; must_change: set a new password before anything else; expired: ask for a new temporary one. */
export function tempPasswordState(mustChange: boolean, expiresAt: Date | null, now: Date): "ok" | "must_change" | "expired" {
  if (!mustChange) return "ok";
  return expiresAt && expiresAt.getTime() >= now.getTime() ? "must_change" : "expired";
}
