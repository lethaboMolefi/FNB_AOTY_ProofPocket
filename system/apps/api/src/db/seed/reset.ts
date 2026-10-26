// pnpm db:reset — DEVELOPMENT ONLY. Drops everything, re-runs migrations and loads the example data.
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { generatePassword } from "../../lib/passwords";
import * as schema from "../schema/index";
import { runMigrations } from "../migrate";
import { exampleAccounts } from "./accounts";
import { seed } from "./seed";
import { pgConfig } from "../pg-config";

/** Git-ignored. Keeps the same passwords across resets so you don't have to relearn them. */
export const CREDENTIALS_FILE = fileURLToPath(new URL("../../../.seed-credentials.json", import.meta.url));

export function assertResettable(env: NodeJS.ProcessEnv, url: string) {
  if (env.NODE_ENV === "production") throw new Error("db:reset is never allowed in production");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "db"].includes(host) && env.ALLOW_REMOTE_RESET !== "yes") {
    throw new Error(`Refusing to reset a database on ${host}. Set ALLOW_REMOTE_RESET=yes only for a disposable test instance.`);
  }
}

export async function resetDatabase(url: string, opts: { accountKey: string; adminEmail: string; today?: string; passwords?: Record<string, string> }) {
  const pool = new pg.Pool({ ...pgConfig(url), max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await runMigrations(url);
    await seed(drizzle(pool, { schema }), opts);
  } finally {
    await pool.end();
  }
}

/** Reuses saved passwords and generates strong ones for any new example account. */
export function loadOrCreatePasswords(adminEmail: string, file = CREDENTIALS_FILE) {
  const saved: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const accounts = exampleAccounts(adminEmail);
  const passwords = Object.fromEntries(accounts.map((a) => [a.email, saved[a.email] ?? generatePassword()]));
  writeFileSync(file, JSON.stringify(passwords, null, 2) + "\n");
  chmodSync(file, 0o600);
  return { accounts, passwords };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  assertResettable(process.env, url);
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@proofpocket.example";
  // Test databases only: one known password for every example account (used by the end-to-end tests).
  const fixed = process.env.SEED_FIXED_PASSWORD;
  if (fixed && !new URL(url).pathname.endsWith("_test")) throw new Error("SEED_FIXED_PASSWORD is only for *_test databases");
  const { accounts, passwords } = fixed
    ? { accounts: exampleAccounts(adminEmail), passwords: Object.fromEntries(exampleAccounts(adminEmail).map((a) => [a.email, fixed])) }
    : loadOrCreatePasswords(adminEmail);
  await resetDatabase(url, { accountKey: process.env.ACCOUNT_NUMBER_KEY ?? "", adminEmail, passwords });
  if (fixed) console.log("Example data loaded (test passwords).");
  else {
    console.log("Example data loaded. Sign-in details (also in apps/api/.seed-credentials.json):\n");
    console.table(accounts.map((a) => ({ role: a.role, who: a.who, email: a.email, password: passwords[a.email] })));
  }
}
