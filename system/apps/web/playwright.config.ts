import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Fresh keys and example-account password for every run, shared by the global setup, the test API and the tests.
process.env.E2E_ACCOUNT_NUMBER_KEY ??= randomBytes(32).toString("base64");
process.env.E2E_OTP_SECRET ??= randomBytes(32).toString("base64");
process.env.E2E_PASSWORD ??= `e2e-${randomBytes(12).toString("base64url")}`;

// Runs against the production build (service worker included) and its own API on port 8788, using the
// proofpocket_test database freshly loaded with the example data, so your dev data is never touched.
const TEST_DB = "postgres://proofpocket_app:app_dev_password@localhost:5433/proofpocket_test";
/** The test API writes emails here so tests can read PINs. */
export const MAIL_DIR = new URL("./.e2e-mail", import.meta.url).pathname;
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: "pnpm exec tsx --env-file=.env src/server.ts",
      cwd: "../api",
      env: {
        PORT: "8788", AUTH_RATE_LIMIT: "2000", DATABASE_URL: TEST_DB, NODE_ENV: "development", AUTH_MODE: "local",
        ACCOUNT_NUMBER_KEY: process.env.E2E_ACCOUNT_NUMBER_KEY!, OTP_SECRET: process.env.E2E_OTP_SECRET!, MAIL_MODE: "file", MAIL_DIR, STORAGE_MODE: "local", STORAGE_DIR: new URL("./.e2e-uploads", import.meta.url).pathname },
      url: "http://localhost:8788/api/v1/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
      env: { API_PROXY: "http://localhost:8788", VITE_AUTH_MODE: "local" },
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
