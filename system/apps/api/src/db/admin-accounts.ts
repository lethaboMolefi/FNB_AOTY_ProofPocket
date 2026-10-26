// Admin accounts made by an operator, with temporary passwords. Shared by the job (database rows only, never a
// password) and the operator's own terminal (sets the passwords; production: Firebase, development: local scrypt).
import { randomInt } from "node:crypto";
import { TEMP_PASSWORD_DAYS } from "@proofpocket/shared";
import type pg from "pg";
import { hashPassword } from "../lib/passwords";

export type AdminResult = { email: string; status: "created" | "reissued" | "skipped"; note?: string };

/**
 * created: a new admin who must change their temporary password within 7 days. Existing emails are skipped, never
 * overwritten. reissue: a new 7-day window for an admin who hasn't set their own password yet (an expired temporary one).
 */
export async function adminRows(pool: pg.Pool, emails: string[], opts: { reissue?: boolean } = {}): Promise<AdminResult[]> {
  const out: AdminResult[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { out.push({ email, status: "skipped", note: "not an email address" }); continue; }
    const existing = (await pool.query<{ id: string; role: string; must_change_password: boolean }>("select id, role, must_change_password from users where lower(email) = $1", [email])).rows[0];
    if (opts.reissue) {
      if (!existing || existing.role !== "admin") { out.push({ email, status: "skipped", note: "no admin account with this email" }); continue; }
      if (!existing.must_change_password) { out.push({ email, status: "skipped", note: "has already set their own password" }); continue; }
      await pool.query(`update users set temp_password_expires_at = now() + make_interval(days => $2) where id = $1`, [existing.id, TEMP_PASSWORD_DAYS]);
      await pool.query("insert into audit_log (actor_role, action, entity, entity_id) values ('system', 'admin.temp_password_reissued', 'user', $1)", [existing.id]);
      out.push({ email, status: "reissued" });
      continue;
    }
    if (existing) { out.push({ email, status: "skipped", note: `already has ${existing.role === "admin" ? "an" : "a"} ${existing.role} account` }); continue; }
    const u = (await pool.query<{ id: string }>(
      `insert into users (email, display_name, role, must_change_password, temp_password_expires_at)
       values ($1, 'ProofPocket admin', 'admin', true, now() + make_interval(days => $2)) returning id`, [email, TEMP_PASSWORD_DAYS])).rows[0]!;
    await pool.query("insert into audit_log (actor_role, action, entity, entity_id, after) values ('system', 'admin.added', 'user', $1, $2)", [u.id, JSON.stringify({ email, temporaryPassword: true })]);
    out.push({ email, status: "created" });
  }
  return out;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ", LOWER = "abcdefghijkmnopqrstuvwxyz", DIGITS = "23456789", SYMBOLS = "!@#$%^&*-_=+?";
const pick = (set: string) => set[randomInt(set.length)]!;

/** 18 random characters with at least one upper case letter, lower case letter, digit and symbol (crypto RNG). */
export function generateTempPassword(length = 18): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS), ...Array.from({ length: length - 4 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!]; }
  return chars.join("");
}

/** Development only: the local sign-in's scrypt hash (production passwords live in Firebase). Never stores plain text. */
export async function setLocalPassword(pool: pg.Pool, email: string, password: string) {
  const hash = await hashPassword(password);
  const updated = await pool.query("update local_credentials set password_hash = $2, failed_attempts = 0, locked_until = null, updated_at = now() where lower(email) = $1", [email, hash]);
  if (!updated.rowCount) await pool.query("insert into local_credentials (email, password_hash) values ($1, $2)", [email, hash]);
}

/** The one place temporary passwords are shown: a table on the operator's own terminal. */
export function printPasswordTable(rows: { email: string; password: string }[]) {
  const w = Math.max(5, ...rows.map((r) => r.email.length));
  console.log(`\n${"Email".padEnd(w)}  Temporary password (shown once; valid ${TEMP_PASSWORD_DAYS} days)`);
  console.log(`${"-".repeat(w)}  ${"-".repeat(40)}`);
  for (const r of rows) console.log(`${r.email.padEnd(w)}  ${r.password}`);
  console.log("");
}
