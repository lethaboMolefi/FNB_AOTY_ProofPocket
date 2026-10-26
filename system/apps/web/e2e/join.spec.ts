import { expect, test, type Page } from "@playwright/test";
import { PDF, signIn, signInWithAuthenticator, signUpCode } from "./helpers";

/** Pick from a shadcn (Radix) select by its label. */
async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).first().click();
}

test("join → upload → approve → Verified", async ({ page }, info) => {
  const email = `e2e.${info.project.name}.${Date.now()}@proofpocket.example`;
  const business = `E2E Spaza ${info.project.name} ${Date.now() % 100000}`;

  // 1. Details, with a new account (dashborad's Join).
  await page.goto("/join");
  await page.getByRole("button", { name: /Business Founder/ }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password (at least 12 characters)", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Confirm password", { exact: true }).fill("a lovely long passphrase");
  await page.getByLabel("Your full name").fill("Ayanda E.");
  await page.getByLabel("SA ID number").fill("8001015009087");
  await page.getByLabel("Mobile number").fill("0821234567");
  await page.getByLabel("Business name").fill(business);
  await choose(page, "Type of business", /Retail/);
  await page.getByLabel("Town or township").fill("Umlazi");
  await choose(page, "Province", "KwaZulu-Natal");
  await page.getByText("Yes, registered", { exact: true }).click();
  await page.getByLabel("Registered company name").fill(business);
  await page.getByLabel("CIPC registration number").fill("2025/777001/07");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2. Documents: the four the checker needs, each with a fingerprint.
  await expect(page.getByText("Required documents")).toBeVisible();
  const files = page.locator('input[type="file"]');
  for (let i = 0; i < 4; i++) {
    await files.nth(i).setInputFiles({ name: `doc-${i}.pdf`, mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByText(/Fingerprint [0-9a-f]{16}/)).toHaveCount(i + 1);
  }
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Consent and join.
  await page.getByRole("button", { name: "Join ProofPocket" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel(/These documents belong to me/).check();
  await page.getByRole("button", { name: "Join ProofPocket" }).click();
  await expect(page).toHaveURL(/\/app\/(home|start)$/);
  await page.getByRole("button", { name: "Sign out" }).click();

  // The ProofPocket checker (admin, with Google Authenticator) approves all four.
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await expect(page).toHaveURL(/\/admin\/overview$/);
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/admin\/checks$/);
  for (let i = 0; i < 4; i++) {
    const row = page.getByRole("listitem").filter({ hasText: business }).first();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(i < 3 ? "Approved" : `${business} is now Verified`, { exact: true })).toBeVisible();
    if (i < 3) await expect(page.getByRole("listitem").filter({ hasText: business })).toHaveCount(3 - i);
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

  // 1. A sign-in first (Sign up page), then the application on Join.
  await page.goto("/join");
  await page.getByRole("button", { name: /Investor \/ Funder/ }).click();
  await page.getByRole("link", { name: "Create a sign-in" }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a lovely long passphrase");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("6-digit code").fill(await signUpCode(email));
  await page.getByRole("button", { name: "Verify and create account" }).click();
  await expect(page).toHaveURL(/\/join$/);
  await page.getByRole("button", { name: /Investor \/ Funder/ }).click();
  await page.getByLabel("Full name").fill("Sipho Dlamini");
  await page.getByLabel("SA ID number").fill("8001015009088");
  await page.getByLabel("Your role").fill("Investment manager");
  await page.getByLabel("Your email").fill("sipho@example.co.za");
  await page.getByLabel("Your phone").fill("0821234567");
  await page.getByLabel("Organisation name").fill(org);
  await choose(page, "Investor / funder type", /Grant/);
  await page.getByLabel("Website").fill("https://ubuntu.example.co.za");
  await page.getByLabel("Organisation email").fill("info@ubuntu.example.co.za");
  await page.getByLabel("Organisation phone").fill("011 123 4567");
  await choose(page, "Province", "Gauteng");
  await page.getByLabel("Town / city").fill("Johannesburg");
  await page.getByLabel("Physical address").fill("1 Main Road, Sandton");
  await page.getByRole("button", { name: /Continue/ }).click();
  // A mistyped ID number is caught before anything is sent.
  await expect(page.getByText(/Check the ID number/)).toBeVisible();
  await page.getByLabel("SA ID number").fill("8001015009087");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Catering", exact: true }).click();
  await page.getByRole("button", { name: "Early revenue" }).click();
  await page.getByRole("button", { name: "Grant", exact: true }).click();
  await page.getByLabel("Min ticket size (ZAR)").fill("10000");
  await page.getByLabel("Max ticket size (ZAR)").fill("200000");
  await choose(page, "Assets under management", /1.*10/);
  await page.getByLabel("Investment mandate description").fill("Township food businesses in Gauteng.");
  await page.getByRole("button", { name: "Submit application" }).click();
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

test("the logo on Join always leads to sign-in, even part-way through joining", async ({ page }, info) => {
  const email = `e2e.half.${info.project.name}.${Date.now()}@proofpocket.example`;
  await page.goto("/join");
  await page.getByRole("button", { name: /Business Founder/ }).click();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("link", { name: "ProofPocket: go to sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  // A sign-in with no business yet: Join says which email it uses, and the logo still reaches sign-in.
  const r = await page.request.post("/api/v1/auth/local/sign-up", { data: { email, password: "a lovely long passphrase" } });
  expect(r.ok()).toBe(true);
  await page.evaluate((t) => localStorage.setItem("pp.session", t), (await r.json()).token);
  await page.goto("/");
  await expect(page).toHaveURL(/\/join$/);
  await page.getByRole("button", { name: /Business Founder/ }).click();
  await expect(page.getByText(`You're signing up as ${email}.`)).toBeVisible();
  await page.getByRole("link", { name: "ProofPocket: go to sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});
