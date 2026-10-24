import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Home shows the founder's journey, figures and things to watch", async ({ page }) => {
  await signIn(page, "zanele@proofpocket.example");
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  const journey = page.getByRole("navigation", { name: "Your journey" });
  await expect(journey.getByRole("link")).toHaveCount(5);
  await expect(page.getByText("You're on a Starter account.")).toBeVisible();
  await expect(page.getByText("2 possible scams need your attention.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Things to watch" })).toBeVisible();
  await expect(page.getByText("Starter account, not yet verified")).toBeVisible();
  await expect(page.getByText("Protect your account with Google Authenticator.")).toBeVisible();
});

test("offline entries are saved on the phone and sync exactly once", async ({ page, context }, info) => {
  const note = `Offline sale ${info.project.name} ${Date.now() % 100000}`;
  await signIn(page, "sipho@proofpocket.example");
  await page.goto("/app/books");
  await expect(page.getByRole("heading", { name: "Add an entry" })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });

  await context.setOffline(true);
  await page.getByLabel("Amount (R)").fill("333");
  await page.getByLabel("What was it for?").fill(note);
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Saved on this phone, will sync")).toBeVisible();
  const row = page.locator("tr", { hasText: note });
  await expect(row.getByText("Waiting to sync")).toBeVisible();

  // Back online: the outbox sends it. Firing "online" twice must still store it once.
  await context.setOffline(false);
  await page.evaluate(() => { window.dispatchEvent(new Event("online")); window.dispatchEvent(new Event("online")); });
  await expect(row.getByText("Waiting to sync")).toHaveCount(0, { timeout: 15_000 });
  await page.reload();
  await expect(page.locator("tr", { hasText: note })).toHaveCount(1);
  await expect(page.locator("tr", { hasText: note }).getByText("+R333")).toBeVisible();
});

test("the same amount paid out twice in a week needs a second Save", async ({ page }, info) => {
  const amount = String(4000 + (info.project.name === "phone" ? 11 : 22));
  await signIn(page, "kabelo@proofpocket.example");
  await page.goto("/app/books");
  await page.getByRole("button", { name: "Money out" }).click();
  for (const note of ["Bakkie service", "Bakkie service again"]) {
    await page.getByLabel("Amount (R)").fill(amount);
    await page.getByLabel("What was it for?").fill(note);
    await page.getByRole("button", { name: "Save entry" }).click();
    if (note === "Bakkie service") await expect(page.getByText("Saved to your books")).toBeVisible();
  }
  await expect(page.getByText(/^Possible duplicate: you paid R4/)).toBeVisible();
  await page.getByRole("button", { name: "Save again" }).click();
  await expect(page.locator("tr", { hasText: "Bakkie service again" })).toHaveCount(1);
});
