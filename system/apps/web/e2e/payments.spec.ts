import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");

test("full payment flow: request → client proof → not received twice → flagged", async ({ page, context }, info) => {
  const client = `Client ${info.project.name} ${Date.now() % 100000}`;
  await signIn(page, "zanele@proofpocket.example");
  await page.goto("/app/payments");
  await expect(page.getByRole("heading", { name: "Ask a client to pay" })).toBeVisible();
  await expect(page.getByText("To add or change payment details, first set up")).toBeVisible();

  // 1. Ask a client to pay.
  await page.getByLabel("Client").fill(client);
  await page.getByLabel("Amount (R)").first().fill("200");
  await page.getByLabel("For", { exact: true }).first().fill("Gel overlay");
  await page.getByRole("button", { name: "Create payment request" }).click();
  await expect(page.getByText(/^Request PP-\d{4} created/)).toBeVisible();
  const link = (await page.locator("form .fp").first().textContent())!.trim();
  expect(link).toMatch(/\/pay\/PP-\d{4}-[\w-]+$/);
  await expect(page.getByRole("link", { name: "Send on WhatsApp" }).first()).toHaveAttribute("href", /wa\.me/);

  // 2. The client opens the link (no account) and sends a proof with the wrong amount.
  const clientPage = await context.newPage();
  const path = new URL(link).pathname;
  await clientPage.goto(path);
  await expect(clientPage.getByRole("heading", { name: "Nala Nails & Lashes" })).toBeVisible();
  await expect(clientPage.getByText("Only pay to the details on this page.")).toBeVisible();
  await expect(clientPage.getByText("1452 336 871")).toBeVisible();
  const sendProof = async () => {
    await clientPage.getByLabel("Amount you paid (R)").fill("150");
    await clientPage.locator('input[type="file"]').setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.from(client)]) });
    await expect(clientPage.getByText("receipt.png")).toBeVisible();
    await clientPage.getByRole("button", { name: "Send proof of payment" }).click();
    await expect(clientPage.getByText("Proof of payment sent.")).toBeVisible();
  };
  await sendProof();

  // 3. The founder checks it and says it's not in the bank.
  await page.reload();
  const box = page.locator(".popbox", { hasText: client });
  await expect(box.getByText("Amount on proof is R150, request is R200")).toBeVisible();
  await box.getByRole("button", { name: "Not received" }).click();
  await expect(page.getByText("Marked not received. The client can upload proof again.")).toBeVisible();

  // 4. The client tries again with the same screenshot; the second rejection flags it.
  await clientPage.reload();
  await expect(clientPage.getByText("hasn't received this payment yet")).toBeVisible();
  await sendProof();
  await page.reload();
  await expect(page.locator(".popbox", { hasText: client }).getByText("This exact file was used as proof before")).toBeVisible();
  await page.locator(".popbox", { hasText: client }).getByRole("button", { name: "Not received" }).click();
  await expect(page.getByText("Marked not received. Flagged as a possible fake proof of payment.")).toBeVisible();

  await clientPage.reload();
  await expect(clientPage.getByText("This request is closed.")).toBeVisible();
  await page.goto("/app/protection");
  await expect(page.getByText(`${client.split(" ")[0]} ${client.split(" ")[1]} ${client.split(" ")[2]} (client)`)).toBeVisible();
  await expect(page.getByText("Possible fake proof of payment").first()).toBeVisible();
});

test("a wrong payment link shows nothing about the business", async ({ page }) => {
  await page.goto("/pay/PP-4821-not-the-real-token");
  await expect(page.getByText("This payment link isn't valid.")).toBeVisible();
  await expect(page.getByText("Nala")).toHaveCount(0);
});

test("supplier on hold blocks recording a payment", async ({ page }) => {
  await signIn(page, "zanele@proofpocket.example");
  await page.goto("/app/protection");
  await expect(page.getByText("New details received")).toBeVisible();
  await page.goto("/app/payments");
  await page.locator("form", { hasText: "Record a supplier payment" }).getByLabel("Amount (R)").fill("500");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment blocked: Glam Supplies's bank details changed.")).toBeVisible();
});
