// Every role against every portal by direct URL (the web app's half of the access matrix; the API's half is
// apps/api/test/access-matrix.test.ts), plus two cross-role flows: admin invites a buyer who then signs in,
// and a signed-in person with no account is kept on Join.
import { readdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { MAIL_DIR } from "../playwright.config";
import { signIn, signInWithAuthenticator } from "./helpers";

const PORTALS = ["/app/home", "/funder/pipeline", "/adviser/cohort", "/admin/checks"] as const;

async function expectLanding(page: Page, from: string, to: RegExp) {
  await page.goto(from);
  await expect(page, `${from} → ${to}`).toHaveURL(to);
}

test("signed out: every portal sends you to sign-in; public pages open", async ({ page }) => {
  for (const p of [...PORTALS, "/"]) await expectLanding(page, p, /\/sign-in$/);
  for (const p of ["/directory", "/privacy-notice", "/join", "/sign-in"]) {
    await page.goto(p);
    await expect(page).toHaveURL(new RegExp(`${p}$`));
    await expect(page.locator("h1").first()).toBeVisible();
  }
});

test("joining (signed in, no account): every portal sends you to Join", async ({ page }, info) => {
  const email = `e2e.joining.${info.project.name}.${Date.now()}@proofpocket.example`;
  const r = await page.request.post("/api/v1/auth/local/sign-up", { data: { email, password: "a lovely long passphrase" } });
  expect(r.ok()).toBe(true);
  await page.goto("/sign-in");
  await page.evaluate((t) => localStorage.setItem("pp.session", t), (await r.json()).token);
  for (const p of [...PORTALS, "/"]) await expectLanding(page, p, /\/join$/);
  // The API refuses the same person on portal endpoints.
  const me = await page.request.get("/api/v1/founder/home", { headers: { Authorization: `Bearer ${(await r.json()).token}` } });
  expect(me.status()).toBe(403);
});

test("founder: own portal only", async ({ page }) => {
  await signIn(page, "zanele@proofpocket.example");
  for (const p of PORTALS.slice(1)) await expectLanding(page, p, /\/app\/home$/);
  await expectLanding(page, "/join", /\/app\/home$/);
  await page.goto("/directory");
  await expect(page).toHaveURL(/\/directory$/);
});

test("funder: own portal only", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "lesedi@proofpocket.example" : "kopano@proofpocket.example");
  for (const p of ["/app/home", "/adviser/cohort", "/admin/checks", "/join", "/"]) await expectLanding(page, p, /\/funder\/pipeline$/);
});

test("adviser: own portal only", async ({ page, isMobile }) => {
  await signInWithAuthenticator(page, isMobile ? "n.mokoena@proofpocket.example" : "l.dube@proofpocket.example");
  for (const p of ["/app/home", "/funder/pipeline", "/admin/checks", "/join", "/"]) await expectLanding(page, p, /\/adviser\/cohort$/);
});

test("admin invites a buyer; the buyer signs in with the emailed password and lands on the directory", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow; one buyer is enough.");
  const email = `e2e.buyer.${Date.now()}@proofpocket.example`;
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await page.goto("/admin/organisations");
  const buyers = page.getByRole("heading", { name: "Buyers", exact: true }).locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
  const firstBuyer = buyers.getByRole("listitem").first();
  await expect(firstBuyer).toBeVisible();
  // Buyers have no invite form in the admin screen today (people are invited for funders and incubators only).
  await expect(firstBuyer.getByRole("button", { name: "Invite" })).toHaveCount(0);
  for (const p of ["/app/home", "/funder/pipeline", "/adviser/cohort", "/join", "/"]) await expectLanding(page, p, /\/admin\/checks$/);
  // Invite through the API the admin screen uses, as the admin.
  const orgs = await page.evaluate(async () => {
    const t = localStorage.getItem("pp.session");
    return (await (await fetch("/api/v1/admin/organisations", { headers: { Authorization: `Bearer ${t}` } })).json()) as { organisations: { id: string; type: string }[] };
  });
  const buyerOrg = orgs.organisations.find((o) => o.type === "buyer")!;
  const sent = await page.evaluate(async ([orgId, mail]) => {
    const t = localStorage.getItem("pp.session");
    const r = await fetch("/api/v1/admin/users", { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ orgId, email: mail, displayName: "E2E Buyer" }) });
    return r.status;
  }, [buyerOrg.id, email] as const);
  expect(sent).toBe(200);
  await page.getByRole("button", { name: "Sign out" }).click();

  const file = readdirSync(MAIL_DIR).filter((f) => f.includes(email.replace(/[^a-z0-9@.]/gi, "_"))).sort().pop()!;
  const mail = JSON.parse(readFileSync(`${MAIL_DIR}/${file}`, "utf8")) as { subject: string; text: string };
  expect(mail.subject).toMatch(/You're invited to ProofPocket/);
  // Buyers don't use Google Authenticator, so their invite doesn't tell them to set it up.
  expect(mail.text).not.toMatch(/Google Authenticator/);
  const password = /temporary password is (\S+)\./.exec(mail.text)![1]!;
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/directory$/);
  for (const p of PORTALS) await expectLanding(page, p, /\/directory$/);
});
