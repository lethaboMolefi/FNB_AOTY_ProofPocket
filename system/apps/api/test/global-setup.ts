import { exampleAccounts } from "../src/db/seed/accounts";
import { resetDatabase } from "../src/db/seed/reset";
import { resetTotpStore } from "./totp-store";

/** Test database only. Never use outside the test database. */
export const TEST_PASSWORD = "test-only-Passphrase-42";

export default async function setup() {
  const url = process.env.DATABASE_OWNER_URL ?? `postgres://proofpocket_owner:owner_dev_password@${process.env.TEST_DB_HOST ?? "localhost:5433"}/proofpocket_test`;
  const adminEmail = "admin@proofpocket.example";
  const passwords = Object.fromEntries(exampleAccounts(adminEmail).map((a) => [a.email, TEST_PASSWORD]));
  resetTotpStore();
  await resetDatabase(url, { accountKey: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=", adminEmail, passwords });
}
