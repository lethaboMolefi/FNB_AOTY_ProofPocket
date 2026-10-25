// Applies Drizzle migrations as the database owner. Used locally, in CI and by the Cloud Run migration job.
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { pgConfig } from "./pg-config";

// src/db/migrate.ts in development, dist/migrate.js once bundled.
export const MIGRATIONS = process.env.MIGRATIONS_DIR
  ?? fileURLToPath(new URL(import.meta.url.includes("/dist/") ? "../drizzle" : "../../drizzle", import.meta.url));

export async function runMigrations(ownerUrl: string, folder = MIGRATIONS) {
  const pool = new pg.Pool({ ...pgConfig(ownerUrl), max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

// Only when run as its own script (not when bundled into bootstrap.js).
if (/migrate\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  await runMigrations(url);
  console.log("Migrations applied");
}
