import { expect, test } from "@playwright/test";
import { PDF, signIn, signInWithAuthenticator } from "./helpers";

test("join → upload → approve → Verified", async ({ page }, info) => {
  const email = `e2e.${info.project.name}.${Date.now()}@proofpocket.example`;
  const business = `E2E Spaza ${info.project.name} ${Date.now() % 100000}`;

  // 1. Details, with a new account.
  await page.goto("/join");
  await page.getByRole("button", { name: /Business founder/ }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password (at least 12 characters)", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Type it again", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Your name").fill("Ayanda E.");
  await page.getByLabel("SA ID number").fill("8001015009087");
  await page.getByLabel("Cellphone number").fill("0821234567");
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

test("a funder applies, the admin approves, and the funder's portal opens", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  const email = `e2e.funder.${Date.now()}@proofpocket.example`;
  const org = `E2E Ubuntu Fund ${Date.now() % 100000}`;

  // 1. Apply: a new sign-in, the person and organisation, then what they fund.
  await page.goto("/join");
  await page.getByRole("button", { name: /Funder or investor/ }).click();
  await expect(page.getByRole("heading", { name: "Apply for a funder portal" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (at least 12 characters)", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Type it again", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Full name").fill("Sipho Dlamini");
  await page.getByLabel("SA ID number").fill("8001015009088");
  await page.getByLabel("Your role").fill("Investment manager");
  await page.getByLabel("Your work email").fill("sipho@example.co.za");
  await page.getByLabel("Your cellphone number").fill("0821234567");
  await page.getByLabel("Type of funder").selectOption("grant_maker");
  await page.getByLabel("Organisation name").fill(org);
  await page.getByLabel("Website").fill("https://ubuntu.example.co.za");
  await page.getByLabel("Organisation email").fill("info@ubuntu.example.co.za");
  await page.getByLabel("Organisation phone").fill("011 123 4567");
  await page.getByLabel("Province").selectOption("Gauteng");
  await page.getByLabel("Town or city").fill("Johannesburg");
  await page.getByLabel("Physical address").fill("1 Main Road, Sandton");
  await page.getByRole("button", { name: "Continue" }).click();
  // A mistyped ID number is caught before anything is sent.
  await expect(page.getByText("Check the ID number")).toBeVisible();
  await page.getByLabel("SA ID number").fill("8001015009087");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Catering", exact: true }).click();
  await page.getByRole("button", { name: "Early revenue" }).click();
  await page.getByRole("button", { name: "Grant", exact: true }).click();
  await page.getByLabel("Smallest amount (R)").fill("10000");
  await page.getByLabel("Largest amount (R)").fill("200000");
  await page.getByLabel("Funds under management").selectOption("1m_10m");
  await page.getByLabel("Describe what you fund").fill("Township food businesses in Gauteng.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("heading", { name: "We're checking your application" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  // 2. The admin approves it.
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await page.goto("/admin/applications");
  const card = page.getByRole("group", { name: org });
  await expect(card.getByText("••••••••••087")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`${org} approved.`)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  // 3. The new funder signs in and must set up Google Authenticator first.
  await signIn(page, email, "a lovely long passphrase");
  await expect(page).toHaveURL(/\/verify|\/two-step|\/setup/);
});
