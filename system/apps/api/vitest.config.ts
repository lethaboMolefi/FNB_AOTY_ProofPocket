import { defineConfig } from "vitest/config";

const host = process.env.TEST_DB_HOST ?? "localhost:5433";

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
      ACCOUNT_NUMBER_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      OTP_SECRET: "ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=",
    },
  },
});
