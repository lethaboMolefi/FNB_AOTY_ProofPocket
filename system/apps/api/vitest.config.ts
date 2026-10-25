import { randomBytes } from "node:crypto";
import { defineConfig } from "vitest/config";

const host = process.env.TEST_DB_HOST ?? "localhost:5433";
const key = () => randomBytes(32).toString("base64");

// Fresh keys and a fresh example-account password for every run (set here so the global setup sees them too).
process.env.TEST_ACCOUNT_NUMBER_KEY ??= key();
process.env.TEST_OTP_SECRET ??= key();
process.env.TEST_PASSWORD ??= `test-${randomBytes(12).toString("base64url")}`;

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    // Tests share one seeded database; run files one after another.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: `postgres://proofpocket_app:app_dev_password@${host}/proofpocket_test`,
      DATABASE_OWNER_URL: `postgres://proofpocket_owner:owner_dev_password@${host}/proofpocket_test`,
      AUTH_MODE: "dev",
      MAIL_MODE: "console",
      RATE_LIMIT_STORE: "memory",
      STORAGE_MODE: "local",
      STORAGE_DIR: ".local-uploads-test",
      ACCOUNT_NUMBER_KEY: process.env.TEST_ACCOUNT_NUMBER_KEY,
      OTP_SECRET: process.env.TEST_OTP_SECRET,
      TEST_PASSWORD: process.env.TEST_PASSWORD,
    },
  },
});
