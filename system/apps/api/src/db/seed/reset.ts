// pnpm db:reset — DEVELOPMENT ONLY. Drops everything, re-runs migrations and loads the example data.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../schema/index";
import { runMigrations } from "../migrate";
import { seed } from "./seed";

export function assertResettable(env: NodeJS.ProcessEnv, url: string) {
  if (env.NODE_ENV === "production") throw new Error("db:reset is never allowed in production");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "db"].includes(host) && env.ALLOW_REMOTE_RESET !== "yes") {
    throw new Error(`Refusing to reset a database on ${host}. Set ALLOW_REMOTE_RESET=yes only for a disposable test instance.`);
  }
}

export async function resetDatabase(url: string, opts: { accountKey: string; adminEmail: string; today?: string }) {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await runMigrations(url);
    await seed(drizzle(pool, { schema }), opts);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  assertResettable(process.env, url);
  await resetDatabase(url, { accountKey: process.env.ACCOUNT_NUMBER_KEY ?? "", adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@proofpocket.example" });
  console.log("Example data loaded");
}
