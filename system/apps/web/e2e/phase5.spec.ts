import { expect, test } from "@playwright/test";
import { signIn, signInWithAuthenticator } from "./helpers";

test("funder: pipeline hides Starters; offer changes need a reason", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "lesedi@proofpocket.example" : "kopano@proofpocket.example");
  await expect(page).toHaveURL(/\/funder\/pipeline$/);
  await expect(page.getByRole("heading", { name: "Company pipeline" })).toBeVisible();
  const table = page.locator("table");
  await expect(table.getByText("Mabele AgriLink")).toBeVisible();
  await expect(table.getByText("Nala Nails & Lashes")).toHaveCount(0);
  if (!isMobile) return; // Lesedi has the applications; Kopano's run checks the pipeline only.
  await table.getByText("ReKasi Plastics").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "ReKasi Plastics" })).toBeVisible();
  await expect(drawer.getByText("No reason given", { exact: true }).first()).toBeVisible();
  await drawer.getByLabel("New offer (R)").fill("30000");
  await drawer.getByRole("button", { name: "Change offer" }).click();
  await expect(drawer.getByText("Add a reason. Founders see every change to their offer.")).toBeVisible();
  await drawer.getByLabel("Reason the founder will see").fill("Branch cap raised after review");
  await drawer.getByRole("button", { name: "Change offer" }).click();
  await expect(page.getByText("Offer updated and shared with the founder")).toBeVisible();
  await expect(drawer.getByText("Branch cap raised after review").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a new funder must set requirements first", async ({ page, isMobile }) => {
  test.skip(isMobile, "One set-up is enough; the account is shared between projects.");
  await signInWithAuthenticator(page, "bophelo@proofpocket.example");
  await expect(page).toHaveURL(/\/funder\/setup$/);
  await page.goto("/funder/pipeline");
  await expect(page).toHaveURL(/\/funder\/setup$/);
  await page.getByLabel("Programme name").fill("Community Starter Grant");
  await page.getByRole("button", { name: "Save and open pipeline" }).click();
  await expect(page).toHaveURL(/\/funder\/pipeline$/);
  await expect(page.getByText("Requirements saved. Founders can see them now.")).toBeVisible();
});

test("incubator: cohort board, drawer and stage move", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "n.mokoena@proofpocket.example" : "l.dube@proofpocket.example");
  await expect(page).toHaveURL(/\/adviser\/cohort$/);
  await expect(page.getByRole("heading", { name: "Cohort board" })).toBeVisible();
  await page.getByRole("button", { name: /Khanya Solar Installs/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("Latest entries")).toBeVisible();
  const move = drawer.getByRole("button", { name: /^Move to / });
  const label = (await move.textContent())!.replace("Move to ", "");
  await move.click();
  await expect(page.getByText(`Moved to ${label}`)).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Needs attention" }).click();
  await expect(page.getByText("Act now").first()).toBeVisible();
});

test("founder: apply for funding, post, and tenders", async ({ page, isMobile }) => {
  await signIn(page, "tumelo@proofpocket.example");
  await page.goto("/app/funding");
  await expect(page.getByText("Funding ready")).toBeVisible();
  const row = page.locator("tr", { hasText: "Safety & Compliance Grant" });
  if (await row.getByRole("button", { name: "Apply" }).count()) {
    await row.getByRole("textbox").or(row.locator('input[type="number"]')).fill("15000");
    await row.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Application sent to Lesedi Youth Fund")).toBeVisible();
  }
  await expect(page.locator("tr", { hasText: "Safety & Compliance Grant" }).getByText("Applied")).toBeVisible();
  await page.goto("/app/markets");
  const text = `Co-op price alerts by SMS ${isMobile ? "phone" : "desktop"}`;
  await page.getByLabel("What do you want to tell customers?").fill(text);
  await page.getByRole("button", { name: "Save and request a feature" }).click();
  await expect(page.getByText("Saved. ProofPocket reviews feature requests weekly.")).toBeVisible();
  await expect(page.locator(".li", { hasText: text }).getByText("Feature requested")).toBeVisible();
  await page.goto("/app/procurement");
  await expect(page.getByRole("heading", { name: "Procurement" })).toBeVisible();
});

test("admin reviews a feature request; the directory shows it", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await page.goto("/admin/features");
  const item = page.locator(".li", { hasText: "Co-op price alerts by SMS desktop" });
  await item.getByRole("button", { name: "Feature" }).click();
  await expect(page.getByText("Featured for 7 days")).toBeVisible();
  await page.goto("/admin/organisations");
  await expect(page.getByRole("heading", { name: "Funders and investors" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/directory");
  await expect(page.getByText("Co-op price alerts by SMS desktop")).toBeVisible();
});

test("public directory and profiles", async ({ page }) => {
  await page.goto("/directory");
  await expect(page.getByRole("heading", { name: "Verified local businesses" })).toBeVisible();
  await expect(page.getByText("Featured this week")).toBeVisible();
  await expect(page.getByRole("link", { name: /Nala Nails/ })).toHaveCount(0);
  await page.getByLabel("Search").fill("catering");
  await page.getByRole("link", { name: /Mama Tau Catering/ }).click();
  await expect(page.getByRole("heading", { name: "Mama Tau Catering" })).toBeVisible();
  await expect(page.getByText("Verified on ProofPocket.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/27125550166");
  await page.goto("/b/nala-nails-lashes");
  await expect(page.getByText("Starter: not verified yet.")).toBeVisible();
});
