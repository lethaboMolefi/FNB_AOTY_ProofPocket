// Every page of every portal, as its own role: it loads with a heading, no console errors, no failed API calls,
// and no sideways scrolling on phones. Also: the notification bell, and each role kept out of the other portals.
import { expect, test, type Page } from "@playwright/test";
import { ADMIN_NAV, ADVISER_NAV, FOUNDER_NAV, FUNDER_NAV } from "../src/app/nav";
import { signIn, signInWithAuthenticator } from "./helpers";

/** Watches a page for console errors, uncaught errors and failed API calls. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
  page.on("response", (r) => {
    if (r.url().includes("/api/v1/") && r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  return problems;
}

async function visitAll(page: Page, base: string, paths: string[]) {
  const problems = watch(page);
  for (const p of paths) {
    await page.goto(`${base}/${p}`);
    await expect(page, `${base}/${p} stays in its portal`).toHaveURL(new RegExp(`${base}/${p}$`));
    await expect(page.locator("main h1").first(), `${base}/${p} has a heading`).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("status", { name: "Loading" }), `${base}/${p} finishes loading`).toHaveCount(0);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways, `${base}/${p} doesn't scroll sideways`).toBeLessThanOrEqual(1);
  }
  expect(problems, "no console errors or failed API calls").toEqual([]);
}

test("founder: every page loads cleanly, and the bell shows real items", async ({ page }) => {
  await signIn(page, "zanele@proofpocket.example");
  await visitAll(page, "/app", FOUNDER_NAV.flatMap((g) => g.pages.map((p) => p.path)).concat("more"));

  await page.goto("/app/home");
  const bell = page.getByRole("button", { name: /notification/i });
  await expect(bell).toHaveAccessibleName(/^\d+ notifications?$/);
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByText("You're on a Starter account")).toBeVisible();
  await expect(panel.getByText(/SARS/)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 300);
  await expect(panel).toHaveCount(0);

  // Founders can't open other portals.
  for (const other of ["/funder/pipeline", "/adviser/cohort", "/admin/checks"]) {
    await page.goto(other);
    await expect(page).toHaveURL(/\/app\/home$/);
  }
});

test("funder: every page loads cleanly", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "lesedi@proofpocket.example" : "kopano@proofpocket.example");
  await visitAll(page, "/funder", FUNDER_NAV.map((p) => p.path));
  await page.goto("/app/home");
  await expect(page).toHaveURL(/\/funder\/pipeline$/);
});

test("adviser: every page loads cleanly", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "n.mokoena@proofpocket.example" : "l.dube@proofpocket.example");
  await visitAll(page, "/adviser", ADVISER_NAV.map((p) => p.path));
  await page.goto("/admin/checks");
  await expect(page).toHaveURL(/\/adviser\/cohort$/);
});

test("admin: every page loads cleanly", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await visitAll(page, "/admin", ADMIN_NAV.map((p) => p.path));
  await page.goto("/app/home");
  await expect(page).toHaveURL(/\/admin\/overview$/);
});

test("admin: opening a business is recorded in Activity", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await expect(page.getByText("Verified businesses")).toBeVisible();
  await page.goto("/admin/people");
  const businesses = page.getByRole("heading", { name: "Businesses" }).locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
  await businesses.getByLabel("Level").selectOption("verified");
  await businesses.getByRole("button", { name: "Search" }).click();
  const row = businesses.getByRole("row").filter({ has: page.getByRole("button", { name: "Open" }) }).first();
  const name = (await row.locator("td").first().locator("span").first().textContent())!;
  await row.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.goto("/admin/activity");
  await page.getByLabel("Action").selectOption("admin.");
  await page.getByLabel("Company").fill(name);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("admin.company_viewed").first()).toBeVisible();
  await expect(page.getByText(/Audit log intact/)).toBeVisible();
});
