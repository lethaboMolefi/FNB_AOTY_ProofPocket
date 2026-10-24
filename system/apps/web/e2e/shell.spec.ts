import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const NALA = "zanele@proofpocket.example";

test("the manifest makes ProofPocket installable", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m).toMatchObject({ name: "ProofPocket", short_name: "ProofPocket", display: "standalone", theme_color: "#FFFFFF", background_color: "#FFFFFF" });
  expect(m.icons.filter((i: { purpose: string }) => i.purpose === "maskable").map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
});

test("signed-out visitors go to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  // No list of accounts on the sign-in page.
  await expect(page.getByRole("button", { name: /Nala|Lesedi/ })).toHaveCount(0);
});

test("a wrong password gets one generic message", async ({ page }) => {
  await signIn(page, NALA, "not-the-right-password", { expectFailure: true });
  await expect(page.getByRole("alert")).toHaveText("That email and password don't match. Check them and try again.");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("a founder lands on Home with the founder navigation", async ({ page, isMobile }) => {
  await signIn(page, NALA);
  await expect(page).toHaveURL(/\/app\/home$/);
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByText("Nala Nails & Lashes · Soweto, Gauteng")).toBeVisible();
  await expect(page.locator("main").getByText("Starter", { exact: true })).toBeVisible();
  if (isMobile) {
    const tabs = page.getByRole("navigation", { name: "Main" });
    await expect(tabs.getByRole("link")).toHaveText(["Home", "Books", "Get paid", "Markets", "More"]);
    await tabs.getByRole("link", { name: "More" }).click();
    await expect(page.getByRole("link", { name: "Registration steps" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stock" })).toBeVisible();
  } else {
    const rail = page.getByRole("navigation", { name: "Sections" });
    for (const g of ["Start", "Trade", "Get paid", "Manage cash flow", "Reach formal markets", "Stay safe"]) await expect(rail.getByText(g, { exact: true })).toBeVisible();
    await rail.getByRole("link", { name: "Fraud protection" }).click();
    await expect(page.getByRole("heading", { name: "Fraud protection" })).toBeVisible();
  }
});

test("a services business doesn't see Stock", async ({ page, isMobile }) => {
  await signIn(page, "tumelo@proofpocket.example");
  await expect(page).toHaveURL(/\/app\/home$/);
  if (isMobile) await page.getByRole("link", { name: "More" }).click();
  await expect(page.getByRole("link", { name: "Bookkeeping" }).or(page.getByRole("link", { name: "Registration steps" })).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Stock" })).toHaveCount(0);
});

test("each role sees only its own portal", async ({ page }) => {
  await signIn(page, "palesa@proofpocket.example");
  await expect(page).toHaveURL(/\/app\/home$/);
  await page.goto("/funder/pipeline");
  await expect(page).toHaveURL(/\/app\/home$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app\/home$/);
});

test("funders must set up Google Authenticator before the portal", async ({ page }) => {
  await signIn(page, "lesedi@proofpocket.example");
  await expect(page).toHaveURL(/\/verify$/);
  await expect(page.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR code to scan with Google Authenticator" })).toBeVisible();
  await expect(page.getByTestId("totp-secret")).toHaveText(/^[A-Z2-7 ]{32,40}$/);
  await page.goto("/funder/pipeline");
  await expect(page).toHaveURL(/\/verify$/);
});

test("the app shell opens offline", async ({ page, context }) => {
  await signIn(page, NALA);
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // A reload after the worker takes control puts /me in the founder cache.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await expect(page.getByText("Nala Nails & Lashes · Soweto, Gauteng")).toBeVisible();
  await context.setOffline(false);
});
