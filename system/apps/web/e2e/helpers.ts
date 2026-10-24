import { createHmac } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** Test database only. */
export const E2E_PASSWORD = "e2e-only-Passphrase-77";

export async function signIn(page: Page, email: string, password = E2E_PASSWORD, opts: { expectFailure?: boolean } = {}) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Passwords are checked with scrypt, which is slow on purpose; wait until we've left the sign-in page.
  if (!opts.expectFailure) await page.waitForURL((u) => !u.pathname.endsWith("/sign-in"));
}

// ---------------------------------------------------------------- Google Authenticator
const TOTP_STORE = new URL("../.e2e-totp.json", import.meta.url).pathname;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32(s: string) {
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of s.replace(/\s/g, "").toUpperCase()) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
/** The code Google Authenticator would show for a 30-second step. */
export function totp(secret: string, step: number) {
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", b32(secret)).update(c).digest();
  const o = h[h.length - 1]! & 15;
  return String((((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!) % 1e6).padStart(6, "0");
}
type Store = Record<string, { secret: string; lastStep: number }>;
const readStore = (): Store => (existsSync(TOTP_STORE) ? JSON.parse(readFileSync(TOTP_STORE, "utf8")) : {});
export const clearTotpStore = () => writeFileSync(TOTP_STORE, "{}");

/** A code for a step not used before (codes can't be reused); waits for the next step if needed. */
async function freshCode(email: string, secret: string) {
  const store = readStore();
  const last = store[email]?.lastStep ?? 0;
  let step = Math.max(Math.floor(Date.now() / 30000), last + 1);
  while (step > Math.floor(Date.now() / 30000) + 1) await new Promise((r) => setTimeout(r, 1000));
  step = Math.max(step, Math.floor(Date.now() / 30000));
  store[email] = { secret, lastStep: step };
  writeFileSync(TOTP_STORE, JSON.stringify(store));
  return totp(secret, step);
}

/** Sign in and pass two-step sign-in, setting up Google Authenticator the first time. */
export async function signInWithAuthenticator(page: Page, email: string) {
  await signIn(page, email);
  const setup = page.getByRole("heading", { name: "Set up two-step sign-in" });
  const enter = page.getByRole("heading", { name: "Enter your code" });
  await expect(setup.or(enter)).toBeVisible();
  if (await setup.isVisible()) {
    const secret = (await page.getByTestId("totp-secret").textContent())!.replace(/\s/g, "");
    await page.getByLabel("6-digit code from Google Authenticator").fill(await freshCode(email, secret));
    await page.getByRole("button", { name: "Turn on two-step sign-in" }).click();
  } else {
    const known = readStore()[email];
    if (!known) throw new Error(`no authenticator secret saved for ${email}`);
    await page.getByLabel("Code", { exact: true }).fill(await freshCode(email, known.secret));
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await page.waitForURL((u) => !u.pathname.endsWith("/verify"));
}

export const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
