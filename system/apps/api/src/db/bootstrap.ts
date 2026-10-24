// Cloud Run Job, run after each deploy: migrations, the app role's password, and (once) the example data.
// Never deletes anything: example data is only loaded into an empty database.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { runMigrations } from "./migrate";
import * as schema from "./schema/index";
import { seed } from "./seed/seed";

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) throw new Error("DATABASE_OWNER_URL is required");

await runMigrations(ownerUrl);
console.log("Migrations applied");

const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
try {
  const appPassword = process.env.APP_DB_PASSWORD;
  if (appPassword) {
    // The restricted role the API uses (created by the migrations; not a superuser, so row-level security applies).
    const { rows } = await pool.query("select format('ALTER ROLE proofpocket_app WITH LOGIN PASSWORD %L', $1::text) as sql", [appPassword]);
    await pool.query(rows[0].sql);
    console.log("App role ready");
  }
  if (process.env.SEED_EXAMPLE_DATA === "yes") {
    const { rows } = await pool.query("select count(*)::int as n from organisations");
    if (rows[0].n === 0) {
      await seed(drizzle(pool, { schema }), { accountKey: process.env.ACCOUNT_NUMBER_KEY ?? "", adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@proofpocket.example" });
      console.log("Example data loaded");
    } else console.log("Data already present; example data not loaded");
  }
} finally {
  await pool.end();
}
