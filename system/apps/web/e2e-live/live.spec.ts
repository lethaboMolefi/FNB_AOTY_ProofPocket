import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Passwords come from infra/.hosted-credentials.json (git-ignored), written by infra/deploy.sh users.
const creds = JSON.parse(readFileSync(new URL("../../../../infra/.hosted-credentials.json", import.meta.url), "utf8")) as Record<string, { password: string }>;

test("the hosted PWA: install details, security headers, sign-in, Home, offline", async ({ page, context, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "ProofPocket", display: "standalone", theme_color: "#FFFFFF" });
  const head = await request.get("/");
  expect(head.headers()["strict-transport-security"]).toContain("max-age=");
  expect(head.headers()["content-security-policy"]).toContain("default-src 'self'");

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel("Email").fill("tumelo@proofpocket.example");
  await page.getByLabel("Password", { exact: true }).fill(creds["tumelo@proofpocket.example"]!.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Mabele AgriLink · Polokwane, Limpopo")).toBeVisible();
  await expect(page.getByText("Funding ready")).toBeVisible();

  // The service worker takes over, then the app opens with no connection.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test("phases 4-5 on the hosted site (read-only)", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: "Verified local businesses" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /ReKasi Plastics/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Nala Nails/ })).toHaveCount(0);
  await page.goto("/b/nala-nails-lashes");
  await expect(page.getByText("Starter: not verified yet.")).toBeVisible();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("zanele@proofpocket.example");
  await page.getByLabel("Password", { exact: true }).fill(creds["zanele@proofpocket.example"]!.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.goto("/app/payments");
  await expect(page.getByRole("heading", { name: "Payment requests" })).toBeVisible();
  await expect(page.getByText(/PP-4821/)).toBeVisible();
  await page.goto("/app/funding");
  await expect(page.getByText("Funders can't see you yet")).toBeVisible();
  await page.goto("/app/protection");
  await expect(page.getByText("Funding Approvals Desk")).toBeVisible();
  // The false fingerprint warnings were removed; none remain.
  await expect(page.getByText(/no longer matches the file/)).toHaveCount(0);
});
