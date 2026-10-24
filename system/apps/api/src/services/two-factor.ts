// Two-step sign-in with Google Authenticator only (TOTP). Required for funder, adviser and admin accounts;
// founders choose it. Also asked for before changing the payment details clients see.
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { userTotp, users } from "../db/schema/index";
import { audit, type Actor } from "../lib/audit";
import { decryptField, encryptField } from "../lib/crypto";
import { AppError } from "../lib/errors";
import { matchStep, newSecret, otpauthUri } from "../lib/totp";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

/** Secrets use their own key, derived from the field-encryption key. */
const keyFor = (config: Config) => createHmac("sha256", Buffer.from(config.ACCOUNT_NUMBER_KEY, "base64")).update("proofpocket-totp-secret").digest("base64");

export type CodeResult = "ok" | "wrong" | "used" | "locked" | "not_set_up";

const ERRORS: Record<Exclude<CodeResult, "ok">, [number, string, string]> = {
  wrong: [400, "code_wrong", "That code isn't right. Open Google Authenticator and enter the code shown for ProofPocket now."],
  used: [400, "code_used", "That code has already been used. Wait for the next one in Google Authenticator."],
  locked: [429, "code_locked", `Too many wrong codes. For your safety, wait ${LOCK_MINUTES} minutes and try again.`],
  not_set_up: [400, "authenticator_not_set_up", "Set up Google Authenticator first."],
};
export const codeError = (r: Exclude<CodeResult, "ok">) => new AppError(...ERRORS[r]);

/** Starts (or restarts) set-up: a new secret for the QR code. Not active until the first code is entered. */
export async function startSetup(tx: Tx, config: Config, user: { id: string; email: string }) {
  const [row] = await tx.select().from(userTotp).where(eq(userTotp.userId, user.id));
  if (row?.enabledAt) throw new AppError(409, "authenticator_on", "Google Authenticator is already set up for this account.");
  const secret = newSecret();
  const secretEnc = encryptField(secret, keyFor(config));
  await tx.insert(userTotp).values({ userId: user.id, secretEnc }).onConflictDoUpdate({ target: userTotp.userId, set: { secretEnc, lastStep: 0, failedAttempts: 0, lockedUntil: null } });
  return { secret, otpauthUri: otpauthUri(secret, user.email) };
}

/**
 * Checks a code. Returns the outcome instead of throwing, so the caller can commit the failed-attempt
 * count (or lockout) before reporting it. Accepts a pending secret only during set-up.
 */
export async function checkCode(tx: Tx, config: Config, userId: string, code: string, opts: { pending?: boolean } = {}): Promise<CodeResult> {
  const [row] = await tx.select().from(userTotp).where(eq(userTotp.userId, userId));
  if (!row || (!row.enabledAt && !opts.pending)) return "not_set_up";
  if (row.lockedUntil && row.lockedUntil > new Date()) return "locked";
  const step = matchStep(decryptField(row.secretEnc, keyFor(config)), code);
  if (step === null) {
    const fails = row.failedAttempts + 1;
    await tx.update(userTotp).set(fails >= MAX_FAILS ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedAttempts: fails }).where(eq(userTotp.userId, userId));
    return fails >= MAX_FAILS ? "locked" : "wrong";
  }
  if (step <= row.lastStep) return "used";
  await tx.update(userTotp).set({ lastStep: step, failedAttempts: 0, lockedUntil: null, ...(opts.pending && !row.enabledAt ? { enabledAt: new Date() } : {}) }).where(eq(userTotp.userId, userId));
  return "ok";
}

/** Marks this sign-in (token auth_time) as having passed two-step sign-in. */
export async function markSignInVerified(tx: Tx, userId: string, authTime: number) {
  await tx.update(users).set({ otpVerifiedAuthTime: authTime }).where(eq(users.id, userId));
}

export async function turnOff(tx: Tx, actor: Actor, userId: string) {
  await tx.delete(userTotp).where(eq(userTotp.userId, userId));
  await audit(tx, actor, { action: "two_factor.disabled", entity: "user", entityId: userId });
}

/** Lost phone: an admin removes the authenticator after checking who the person is. They set it up again on next sign-in. */
export async function adminReset(tx: Tx, actor: Actor, userId: string) {
  const [u] = await tx.select({ email: users.email, name: users.displayName }).from(users).where(eq(users.id, userId));
  if (!u) throw new AppError(404, "not_found", "That person wasn't found.");
  await tx.execute(sql`select admin_reset_totp(${userId})`);
  await tx.update(users).set({ otpVerifiedAuthTime: null }).where(eq(users.id, userId));
  await audit(tx, actor, { action: "two_factor.reset_by_admin", entity: "user", entityId: userId });
  return u;
}
