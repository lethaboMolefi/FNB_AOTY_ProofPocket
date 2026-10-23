import { defineConfig, devices } from "@playwright/test";

// Runs against the production build (service worker included) and its own API on port 8788, using the
// proofpocket_test database freshly loaded with the example data, so your dev data is never touched.
const TEST_DB = "postgres://proofpocket_app:app_dev_password@localhost:5433/proofpocket_test";
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: "pnpm exec tsx --env-file=.env src/server.ts",
      cwd: "../api",
      env: { PORT: "8788", DATABASE_URL: TEST_DB, NODE_ENV: "development", AUTH_MODE: "dev", MAIL_MODE: "console" },
      url: "http://localhost:8788/api/v1/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
      env: { API_PROXY: "http://localhost:8788", VITE_AUTH_MODE: "dev" },
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
