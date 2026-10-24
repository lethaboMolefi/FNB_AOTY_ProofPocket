import { exampleAccounts } from "../src/db/seed/accounts";
import { resetDatabase } from "../src/db/seed/reset";
import { resetTotpStore } from "./totp-store";

/** Generated per run in vitest.config.ts; test database only. */
export const TEST_PASSWORD = process.env.TEST_PASSWORD!;

export default async function setup() {
  const url = `postgres://proofpocket_owner:owner_dev_password@${process.env.TEST_DB_HOST ?? "localhost:5433"}/proofpocket_test`;
  const adminEmail = "admin@proofpocket.example";
  const passwords = Object.fromEntries(exampleAccounts(adminEmail).map((a) => [a.email, TEST_PASSWORD]));
  resetTotpStore();
  await resetDatabase(url, { accountKey: process.env.TEST_ACCOUNT_NUMBER_KEY!, adminEmail, passwords });
}
