import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? "postgres://proofpocket_owner:owner_dev_password@localhost:5433/proofpocket" },
  strict: true,
});
