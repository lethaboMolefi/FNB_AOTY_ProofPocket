// When the API fails, screens say so and offer Try again (they used to show "Loading…" for ever).
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The service worker would answer from its cache; this test is about the network failing.
test.use({ serviceWorkers: "block" });

test("a failed request shows an error with Try again, which recovers", async ({ page }) => {
  await signIn(page, "zanele@proofpocket.example");
  let fail = true;
  await page.route("**/api/v1/founder/cashflow", (r) => (fail
    ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "internal", message: "Something went wrong." } }) })
    : r.continue()));
  await page.goto("/app/cashflow");
  await expect(page.getByRole("alert").getByText("Couldn't load this. Check your connection, then try again.")).toBeVisible({ timeout: 20_000 });
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Cash on hand now")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
