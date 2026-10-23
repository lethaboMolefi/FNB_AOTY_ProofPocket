// Email one-time PINs: funder, adviser and admin sign-in, and changing payment details.
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Config } from "../config";
import type { Tx } from "../db/client";
import { otpChallenges, users } from "../db/schema/index";
import { hashCode, sameHash, sixDigitCode } from "../lib/crypto";
import { AppError } from "../lib/errors";
import type { Mailer } from "../lib/mailer";

export type OtpPurpose = "sign_in" | "payment_details";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

const PURPOSE_TEXT: Record<OtpPurpose, string> = {
  sign_in: "to finish signing in",
  payment_details: "to change the payment details clients see",
};

/** "pe•••••@gmail.com" */
export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${(name ?? "").slice(0, 2)}${"•".repeat(Math.max(1, (name ?? "").length - 2))}@${domain ?? ""}`;
}

export async function requestOtp(tx: Tx, deps: { config: Config; mailer: Mailer }, user: { id: string; email: string }, purpose: OtpPurpose) {
  const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(otpChallenges)
    .where(and(eq(otpChallenges.userId, user.id), gt(otpChallenges.createdAt, sql`now() - interval '1 hour'`)))) as [{ n: number }];
  if (n >= MAX_PER_HOUR) throw new AppError(429, "otp_too_many", "You've asked for several PINs. Wait an hour, or use the last one we sent.");

  // Only the newest PIN works.
  await tx.update(otpChallenges).set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.userId, user.id), eq(otpChallenges.purpose, purpose), isNull(otpChallenges.consumedAt)));

  const code = sixDigitCode();
  const id = crypto.randomUUID();
  await tx.insert(otpChallenges).values({
    id, userId: user.id, purpose,
    codeHash: hashCode(code, id, deps.config.OTP_SECRET),
    expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
  });
  await deps.mailer.send({
    to: user.email,
    subject: "Your ProofPocket PIN",
    text: `Your ProofPocket one-time PIN is ${code}. Use it ${PURPOSE_TEXT[purpose]}. It expires in ${TTL_MINUTES} minutes.\n\nProofPocket will never phone you or message you to ask for this PIN. If you didn't ask for it, ignore this email.`,
  });
  return { sentTo: maskEmail(user.email), expiresInMinutes: TTL_MINUTES };
}

export type OtpResult = "ok" | "expired" | "locked" | "wrong";

/**
 * Checks a PIN and uses it up when it matches. Returns the outcome instead of throwing, so the
 * caller can commit the failed-attempt count before reporting the error (see otpError).
 */
export async function checkOtp(tx: Tx, config: Config, userId: string, purpose: OtpPurpose, code: string): Promise<OtpResult> {
  const [c] = await tx.select().from(otpChallenges)
    .where(and(eq(otpChallenges.userId, userId), eq(otpChallenges.purpose, purpose), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())))
    .orderBy(desc(otpChallenges.createdAt)).limit(1);
  if (!c) return "expired";
  if (c.attempts >= MAX_ATTEMPTS) return "locked";
  if (!sameHash(hashCode(code, c.id, config.OTP_SECRET), c.codeHash)) {
    await tx.update(otpChallenges).set({ attempts: c.attempts + 1 }).where(eq(otpChallenges.id, c.id));
    return "wrong";
  }
  await tx.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, c.id));
  return "ok";
}

const OTP_ERRORS: Record<Exclude<OtpResult, "ok">, [string, string]> = {
  expired: ["otp_expired", "That PIN has expired. Ask for a new one."],
  locked: ["otp_locked", "Too many tries. Ask for a new PIN."],
  wrong: ["otp_wrong", "That PIN isn't right. Check the latest email from ProofPocket."],
};
export function otpError(result: Exclude<OtpResult, "ok">) {
  const [code, message] = OTP_ERRORS[result];
  return new AppError(400, code, message);
}

/** Marks this sign-in (Firebase auth_time) as having passed the PIN. */
export async function markSignInVerified(tx: Tx, userId: string, authTime: number) {
  await tx.update(users).set({ otpVerifiedAuthTime: authTime }).where(eq(users.id, userId));
}
