import { expect, test } from "@playwright/test";
import { PDF, signIn, signInWithAuthenticator } from "./helpers";

test("join → upload → approve → Verified", async ({ page }, info) => {
  const email = `e2e.${info.project.name}.${Date.now()}@proofpocket.example`;
  const business = `E2E Spaza ${info.project.name} ${Date.now() % 100000}`;

  // 1. Details, with a new account.
  await page.goto("/join");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 12 characters)", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Type it again", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Your name").fill("Ayanda E.");
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Type of business").selectOption("retail");
  await page.getByLabel("Town or township").fill("Umlazi");
  await page.getByLabel("Province").selectOption("KwaZulu-Natal");
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("CIPC number").fill("2025/777001/07");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2. Documents.
  await expect(page.getByRole("heading", { name: "Documents that prove you're a registered business" })).toBeVisible();
  const rows = page.locator(".upload");
  await expect(rows).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await rows.nth(i).locator('input[type="file"]').setInputFiles({ name: `doc-${i}.pdf`, mimeType: "application/pdf", buffer: PDF });
    await expect(rows.nth(i).getByText(/^Fingerprint [0-9a-f]{16}$/)).toBeVisible();
  }
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Consent and join.
  await page.getByRole("button", { name: "Join ProofPocket" }).click();
  await expect(page.getByRole("alert")).toHaveText("Tick the box to confirm before joining.");
  await page.getByLabel(/These documents belong to me/).check();
  await page.getByRole("button", { name: "Join ProofPocket" }).click();
  await expect(page).toHaveURL(/\/app\/start$/);
  await expect(page.getByText("Welcome! A ProofPocket checker is reviewing your documents.")).toBeVisible();
  await expect(page.getByText("Who checks your documents?")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  // The ProofPocket checker (admin, with Google Authenticator) approves all four.
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await expect(page).toHaveURL(/\/admin\/checks$/);
  for (let i = 0; i < 4; i++) {
    const row = page.locator(".li", { hasText: business }).first();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(i < 3 ? "Approved" : `${business} is now Verified`, { exact: true })).toBeVisible();
    if (i < 3) await expect(page.locator(".li", { hasText: business })).toHaveCount(3 - i);
  }
  await page.getByRole("button", { name: "Sign out" }).click();

  // The founder sees Verified.
  await signIn(page, email, "a lovely long passphrase");
  await page.goto("/app/start");
  await expect(page.getByText(/^Verified\.$/)).toBeVisible();
  await expect(page.locator("main").getByText("Verified", { exact: true }).first()).toBeVisible();
});
