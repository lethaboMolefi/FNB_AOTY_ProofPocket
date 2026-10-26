// Email confirmation at sign-up: a 6-digit code emailed from ProofPocket's own address. Only a hash is stored; a code
// works for 10 minutes and 5 tries, and a new one can be sent every 30 seconds. Once it's right, the sign-in's email
// is marked confirmed (production: in Firebase Authentication, so the next token says so).
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Config } from "../config";
import { withContext, type Db } from "../db/client";
import { emailCodes } from "../db/schema/index";
import { AppError } from "../lib/errors";
import type { Mailer } from "../lib/mailer";

export const CODE_MINUTES = 10, CODE_TRIES = 5, RESEND_SECONDS = 30;
const hash = (uid: string, code: string) => createHash("sha256").update(`${uid}:${code}`).digest("hex");

export async function sendEmailCode(db: Db, mailer: Mailer, who: { uid: string; email: string }, opts: { resend: boolean }) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sent = await withContext(db, { role: "auth" }, async (tx) => {
    const [row] = await tx.select().from(emailCodes).where(eq(emailCodes.firebaseUid, who.uid));
    const fresh = row && row.expiresAt > new Date() && row.attempts < CODE_TRIES && row.email === who.email;
    // Opening the page again doesn't send another email while the last code still works.
    if (fresh && !opts.resend) return false;
    if (row && Date.now() - row.sentAt.getTime() < RESEND_SECONDS * 1000) {
      throw new AppError(429, "too_soon", `Wait ${RESEND_SECONDS} seconds before asking for another code.`);
    }
    const values = { email: who.email, codeHash: hash(who.uid, code), expiresAt: sql`now() + make_interval(mins => ${CODE_MINUTES})`, attempts: 0, sentAt: new Date() };
    await tx.insert(emailCodes).values({ firebaseUid: who.uid, ...values }).onConflictDoUpdate({ target: emailCodes.firebaseUid, set: values });
    return true;
  });
  if (sent) {
    await mailer.send({
      to: who.email,
      subject: "Your ProofPocket confirmation code",
      text: `Your ProofPocket confirmation code is ${code}.\n\nEnter it on the sign-up page to confirm your email address. It works for ${CODE_MINUTES} minutes.\n\nIf you didn't sign up for ProofPocket, you can ignore this email. ProofPocket will never phone you or message you to ask for this code.`,
    });
  }
  return { sent, message: sent ? `We emailed a 6-digit code to ${who.email}.` : `Enter the code we emailed to ${who.email}.` };
}

export async function verifyEmailCode(db: Db, config: Config, who: { uid: string; email: string }, code: string) {
  const ok = await withContext(db, { role: "auth" }, async (tx) => {
    const [row] = await tx.select().from(emailCodes).where(eq(emailCodes.firebaseUid, who.uid));
    if (!row || row.email !== who.email) throw new AppError(400, "code_wrong", "That code isn't right. Ask for a new one.");
    if (row.expiresAt < new Date()) throw new AppError(400, "code_expired", "That code has expired. Ask for a new one.");
    if (row.attempts >= CODE_TRIES) throw new AppError(400, "code_locked", "Too many wrong codes. Ask for a new one.");
    const match = timingSafeEqual(Buffer.from(row.codeHash, "hex"), Buffer.from(hash(who.uid, code), "hex"));
    if (!match) {
      await tx.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.firebaseUid, who.uid));
      return false;
    }
    await tx.delete(emailCodes).where(eq(emailCodes.firebaseUid, who.uid));
    return true;
  });
  if (!ok) throw new AppError(400, "code_wrong", "That code isn't right. Check the email and try again.");
  if (config.AUTH_MODE === "firebase") await getAuth(getApps()[0]).updateUser(who.uid, { emailVerified: true });
  return { message: "Email confirmed" };
}
