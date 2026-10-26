// Admin accounts with temporary passwords, User approvals and UML diagrams, in the browser.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { signIn, signInWithAuthenticator } from "./helpers";

const OWNER = "postgres://proofpocket_owner:owner_dev_password@localhost:5433/proofpocket_test";
const API_DIR = fileURLToPath(new URL("../../api", import.meta.url));

/** Runs the real operator command (development mode) and reads the printed table, the only place passwords appear. */
function makeAdmins(...emails: string[]) {
  const out = execFileSync("pnpm", ["exec", "tsx", "src/db/add-admins.ts", "--local-passwords", ...emails], {
    cwd: API_DIR, encoding: "utf8", env: { ...process.env, DATABASE_OWNER_URL: OWNER, NODE_ENV: "development" },
  });
  const table = Object.fromEntries([...out.matchAll(/^(\S+@\S+)\s{2,}(\S{14,})$/gm)].map((m) => [m[1]!, m[2]!]));
  const results = [...out.matchAll(/^RESULT (.+)$/gm)].map((m) => JSON.parse(m[1]!) as { email: string; status: string });
  return { out, table, results };
}

async function signInWith(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("a new admin must change the temporary password first; it then stops working", async ({ page, isMobile }, info) => {
  test.skip(isMobile, "One run is enough.");
  const email = `e2e.admin.${info.project.name}.${Date.now()}@proofpocket.example`;
  const { table, results, out } = makeAdmins(email, "admin@proofpocket.example");
  expect(results).toEqual([{ email, status: "created" }, { email: "admin@proofpocket.example", status: "skipped", note: "already has an admin account" }]);
  const temp = table[email]!;
  expect(temp).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{14,}$/);
  expect(out).not.toContain("admin@proofpocket.example  "); // skipped accounts get no password

  await signInWith(page, email, temp);
  await expect(page).toHaveURL(/\/change-password$/);
  await expect(page.getByRole("heading", { name: "Set your own password", level: 1 })).toBeVisible();
  // Nothing else is reachable until it's done.
  await page.goto("/admin/overview");
  await expect(page).toHaveURL(/\/change-password$/);
  await page.getByLabel("Temporary password", { exact: true }).fill(temp);
  await page.getByLabel("New password (at least 12 characters)", { exact: true }).fill("my own long admin passphrase");
  await page.getByLabel("New password again", { exact: true }).fill("my own long admin passphrase");
  await page.getByRole("button", { name: "Set new password" }).click();
  // Next: Google Authenticator set-up (required for admins).
  await expect(page).toHaveURL(/\/verify$/);
  await expect(page.getByRole("heading", { name: "Set up two-step sign-in" })).toBeVisible();
  await page.getByRole("button", { name: "Use a different account" }).click();

  await signInWith(page, email, temp);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("admin: user approvals (approve, reject with a reason; founders aren't listed)", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  const stamp = Date.now();
  // Two applications, sent the way Join sends them.
  const apply = async (org: string) => {
    const up = await page.request.post("/api/v1/auth/local/sign-up", { data: { email: `e2e.applicant.${org.replace(/\W/g, "")}@proofpocket.example`, password: "a lovely long passphrase" } });
    const token = (await up.json()).token as string;
    const r = await page.request.post("/api/v1/join/applications", { headers: { Authorization: `Bearer ${token}` }, data: { kind: "funder", details: {
      repName: "Sipho Dlamini", repIdNumber: "8001015009087", repRole: "Investment Manager", repEmail: "sipho@example.co.za", repPhone: "0821234567",
      orgName: org, entityType: "vc", website: "https://ubuntu.example.co.za", email: "info@ubuntu.example.co.za", phone: "0111234567",
      province: "Gauteng", town: "Johannesburg", physicalAddress: "1 Main Road", sectors: ["Catering"], stages: ["early"], instruments: ["grant"],
      ticketMin: 10000, ticketMax: 200000, aumBand: "1m_10m", description: "Food businesses." } } });
    expect(r.ok()).toBe(true);
  };
  await apply(`E2E Yes Fund ${stamp}`);
  await apply(`E2E No Fund ${stamp}`);

  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await page.goto("/admin/approvals");
  await expect(page.getByRole("heading", { name: "User approvals", level: 1 })).toBeVisible();
  await expect(page.locator("main").getByText("zanele@proofpocket.example")).toHaveCount(0);

  const filterTo = async (org: string) => {
    await page.getByLabel("Search").fill(org);
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("row").filter({ hasText: org }).getByRole("button", { name: "Open" }).click();
  };
  await filterTo(`E2E Yes Fund ${stamp}`);
  await expect(page.getByText("••••••••••087")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(`E2E Yes Fund ${stamp} approved.`, { exact: false })).toBeVisible();

  await filterTo(`E2E No Fund ${stamp}`);
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByLabel(/Why it's turned down/).fill("We couldn't confirm the registration.");
  await page.getByRole("button", { name: "Turn down" }).click();
  await expect(page.getByText(/was turned down/)).toBeVisible();

  // Other admins are read-only; founders aren't here at all.
  await page.getByLabel("Search").fill("admin@proofpocket.example");
  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("row").filter({ hasText: "admin@proofpocket.example" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Admin accounts can't be changed here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0);
});

test("UML diagrams: view and download SVG, PNG, PDF and source; other roles are kept out", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await signIn(page, "zanele@proofpocket.example");
  await page.goto("/app/uml");
  await expect(page.getByRole("heading", { name: "UML diagrams", level: 1 })).toBeVisible();
  const img = page.getByRole("img", { name: /Use case diagram/ });
  await expect(img).toBeVisible({ timeout: 20_000 });
  expect(await img.evaluate((e) => (e as HTMLImageElement).naturalWidth)).toBeGreaterThan(200);
  if (!isMobile) {
    await page.getByRole("button", { name: "Funder or NGO registration and admin approval" }).click();
    await expect(page.getByRole("img", { name: /Funder or NGO registration and admin approval/ })).toBeVisible({ timeout: 20_000 });
  }
  for (const [label, ext, min] of [["SVG", "svg", 1000], ["PNG", "png", 1000], ["PDF", "pdf", 1000], ["Source", "mmd", 100]] as const) {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label, exact: true }).click()]);
    expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
    const size = readFileSync((await dl.path())!).length;
    expect(size, `${label} download has content`).toBeGreaterThan(min);
    if (ext === "pdf") expect(readFileSync((await dl.path())!).subarray(0, 5).toString()).toBe("%PDF-");
    if (ext === "png") expect(readFileSync((await dl.path())!).subarray(1, 4).toString()).toBe("PNG");
  }
  expect(errors, "no console errors (the site's content security policy stays strict)").toEqual([]);
});

test("other roles can't open the admin pages or the diagrams", async ({ page }) => {
  await signInWithAuthenticator(page, "n.mokoena@proofpocket.example");
  for (const p of ["/admin/approvals", "/admin/uml", "/admin/profile", "/app/uml", "/app/admin-log"]) {
    await page.goto(p);
    await expect(page).toHaveURL(/\/adviser\/cohort$/);
  }
  const res = await page.evaluate(async () => {
    const t = localStorage.getItem("pp.session");
    const call = (p: string) => fetch(`/api/v1${p}`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.status);
    return { uml: await call("/uml"), approvals: await call("/admin/approvals"), log: await call("/admin-log") };
  });
  expect(res).toEqual({ uml: 403, approvals: 403, log: 403 });
});

test("admin: Testing page lists the test cases and downloads the documents", async ({ page, isMobile }) => {
  test.skip(isMobile, "Admin desktop flow.");
  await signInWithAuthenticator(page, "admin@proofpocket.example");
  await page.goto("/admin/testing");
  await expect(page.getByRole("heading", { name: "Testing", level: 1 })).toBeVisible();
  await page.getByLabel("Search cases").fill("MON-11");
  await expect(page.getByText("MON-11", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Details" }).first().click();
  await expect(page.getByText("admin.company_viewed").first()).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Test cases", exact: true }).click()]);
  expect(dl.suggestedFilename()).toBe("Test-cases.md");
});
