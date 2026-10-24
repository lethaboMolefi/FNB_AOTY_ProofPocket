import { defineConfig, devices } from "@playwright/test";

// Smoke test against the hosted site: LIVE_URL=https://proofpocket-aoty.web.app pnpm exec playwright test -c playwright.live.config.ts
// Uses founder accounts only (staff sign-in would set up Google Authenticator on a real account).
export default defineConfig({
  testDir: "./e2e-live",
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.LIVE_URL ?? "https://proofpocket-aoty.web.app", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
