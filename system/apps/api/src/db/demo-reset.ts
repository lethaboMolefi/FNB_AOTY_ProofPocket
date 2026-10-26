// Demo site only (Cloud Run job, infra/deploy.sh demo_reset): wipes the demo database and loads fresh example data
// with demo accounts for every role, all with DEMO_PASSWORD. Refuses any database that isn't marked as the demo, so
// it can never touch live data (the demo also has its own database server).
import pg from "pg";
import { exampleAccounts } from "./seed/accounts";
import { resetDatabase } from "./seed/reset";
import { DEMO_ADMIN_EMAIL } from "./demo-accounts";
import { pgConfig } from "./pg-config";

/** A database may be reset only if it's empty (first run) or carries the demo marker this job leaves behind. */
export async function assertDemoDatabase(pool: pg.Pool) {
  const marker = (await pool.query("select to_regclass('public.demo_marker') is not null as ok")).rows[0].ok as boolean;
  if (marker) return;
  const hasData = (await pool.query("select to_regclass('public.organisations') is not null as t")).rows[0].t as boolean
    && Number((await pool.query("select count(*) from organisations")).rows[0].count) > 0;
  if (hasData) throw new Error("Refusing to reset: this database has data and isn't marked as the demo.");
}

if (/demo-reset\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const url = process.env.DATABASE_OWNER_URL;
  const password = process.env.DEMO_PASSWORD ?? "";
  if (process.env.DEMO_MODE !== "yes") throw new Error("DEMO_MODE=yes is required");
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  if (password.length < 12) throw new Error("DEMO_PASSWORD (12+ characters) is required");
  const pool = new pg.Pool({ ...pgConfig(url), max: 1 });
  try { await assertDemoDatabase(pool); } finally { await pool.end(); }
  const accounts = exampleAccounts(DEMO_ADMIN_EMAIL);
  await resetDatabase(url, { accountKey: process.env.ACCOUNT_NUMBER_KEY ?? "", adminEmail: DEMO_ADMIN_EMAIL, passwords: Object.fromEntries(accounts.map((a) => [a.email, password])) });
  const after = new pg.Pool({ ...pgConfig(url), max: 1 });
  try {
    await after.query("create table demo_marker (reset_at timestamptz not null default now())");
    await after.query("insert into demo_marker default values");
    // The restricted role the API uses needs its password again only if it was just created; bootstrap sets it.
    if (process.env.APP_DB_PASSWORD) {
      const { rows } = await after.query("select format('ALTER ROLE proofpocket_app WITH LOGIN PASSWORD %L', $1::text) as sql", [process.env.APP_DB_PASSWORD]);
      await after.query(rows[0].sql);
    }
  } finally { await after.end(); }
  console.log(`Demo data loaded: ${accounts.length} demo accounts.`);
}
