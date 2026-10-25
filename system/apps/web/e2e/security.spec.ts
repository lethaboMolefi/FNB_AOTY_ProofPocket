// Security checks in the real browser: stored scripts never run, and founders can get their own data.
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a post containing a script is shown as text and never runs", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); void d.dismiss(); });
  await signIn(page, "zanele@proofpocket.example");
  await page.goto("/app/markets");
  const payload = `XSS check <img src=x onerror="window.__pwned=1;alert('img')"><script>window.__pwned=2</script> ${Date.now()}`;
  await page.getByLabel("What do you want to tell customers?").fill(payload);
  await page.getByRole("button", { name: "Save post" }).click();
  await expect(page.getByText(payload).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(dialogs).toEqual([]);
  expect(await page.locator("img[src='x']").count()).toBe(0);
});

test("privacy: the notice is public and founders can download their data", async ({ page, isMobile }) => {
  test.skip(isMobile, "One run is enough.");
  await page.goto("/privacy-notice");
  await expect(page.getByRole("heading", { name: "Privacy notice" })).toBeVisible();
  await expect(page.getByText("Johannesburg (africa-south1)", { exact: false })).toBeVisible();
  await signIn(page, "zanele@proofpocket.example");
  await page.goto("/app/privacy");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^proofpocket-my-data-\d{4}-\d{2}-\d{2}\.json$/);
});
