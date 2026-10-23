import { resetDatabase } from "../src/db/seed/reset";

export default async function setup() {
  const url = process.env.DATABASE_OWNER_URL ?? `postgres://proofpocket_owner:owner_dev_password@${process.env.TEST_DB_HOST ?? "localhost:5433"}/proofpocket_test`;
  await resetDatabase(url, { accountKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", adminEmail: "admin@proofpocket.example" });
}
