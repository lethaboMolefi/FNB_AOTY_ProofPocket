import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Test database only. */
export const E2E_PASSWORD = "e2e-only-Passphrase-77";
const MAIL_DIR = new URL("../.e2e-mail", import.meta.url).pathname;

export async function signIn(page: Page, email: string, password = E2E_PASSWORD, opts: { expectFailure?: boolean } = {}) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Passwords are checked with scrypt, which is slow on purpose; wait until we've left the sign-in page.
  if (!opts.expectFailure) await page.waitForURL((u) => !u.pathname.endsWith("/sign-in"));
}

/** The PIN in the newest email to this address. */
export async function latestPin(email: string): Promise<string> {
  let pin: string | null = null;
  await expect.poll(() => {
    const files = (() => { try { return readdirSync(MAIL_DIR); } catch { return []; } })().filter((f) => f.includes(email)).sort();
    const last = files.at(-1);
    pin = last ? /\b(\d{6})\b/.exec(JSON.parse(readFileSync(join(MAIL_DIR, last), "utf8")).text)?.[1] ?? null : null;
    return pin;
  }, { timeout: 10_000 }).not.toBeNull();
  return pin!;
}

/** Sign in and pass the email PIN (staff, or founders with two-step sign-in on). */
export async function signInWithPin(page: Page, email: string) {
  await signIn(page, email);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(/We sent a 6-digit PIN/)).toBeVisible();
  await page.getByLabel("PIN").fill(await latestPin(email));
  await page.getByRole("button", { name: "Continue" }).click();
}

export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
