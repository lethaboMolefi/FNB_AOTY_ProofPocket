// Founders (and funder/NGO applicants) sign up with their email only: the sign-in gets a random password nobody
// sees, and the person chooses their own at the end (after Join ProofPocket, or after sending their application).
// Marking a sign-in this way is allowed only just after it was created, so it can't be used on an existing account.
import { passwordFor } from "@proofpocket/shared";
import { eq, sql } from "drizzle-orm";
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Config } from "../config";
import { withContext, type Db } from "../db/client";
import { localCredentials, passwordPending } from "../db/schema/index";
import { AppError } from "../lib/errors";
import { hashPassword } from "../lib/passwords";

export const NEW_SIGN_IN_MINUTES = 15;

async function createdAt(db: Db, config: Config, who: { uid: string; email: string }): Promise<Date | null> {
  if (config.AUTH_MODE === "firebase") {
    const u = await getAuth(getApps()[0]).getUser(who.uid);
    return new Date(u.metadata.creationTime);
  }
  const [row] = await withContext(db, { role: "auth" }, (tx) =>
    tx.select({ createdAt: localCredentials.createdAt }).from(localCredentials).where(sql`lower(${localCredentials.email}) = ${who.email}`));
  return row?.createdAt ?? null;
}

export async function markPasswordLater(db: Db, config: Config, who: { uid: string; email: string }) {
  const created = await createdAt(db, config, who);
  if (!created || Date.now() - created.getTime() > NEW_SIGN_IN_MINUTES * 60_000) {
    throw new AppError(403, "not_new", "Only a sign-in that was just created can choose its password later.");
  }
  await withContext(db, { role: "auth" }, (tx) => tx.insert(passwordPending).values({ firebaseUid: who.uid, email: who.email }).onConflictDoNothing());
  return { pending: true };
}

export async function passwordLaterStatus(db: Db, uid: string) {
  const [row] = await withContext(db, { role: "auth" }, (tx) => tx.select().from(passwordPending).where(eq(passwordPending.firebaseUid, uid)));
  return { pending: !!row };
}

/** The person's own password, once. Production: Firebase Authentication; development: the local scrypt hash. */
export async function setFirstPassword(db: Db, config: Config, who: { uid: string; email: string }, password: string) {
  const { pending } = await passwordLaterStatus(db, who.uid);
  if (!pending) throw new AppError(409, "password_already_set", "Your password is already set. Change it from your settings instead.");
  const rule = passwordFor(who.email).safeParse(password);
  if (!rule.success) throw new AppError(400, "weak_password", rule.error.issues[0]!.message);
  if (config.AUTH_MODE === "firebase") {
    try { await getAuth(getApps()[0]).updateUser(who.uid, { password }); }
    catch { throw new AppError(503, "password_failed", "We couldn't save your password just now. Try again in a minute."); }
  } else {
    const hash = await hashPassword(password);
    await withContext(db, { role: "auth" }, (tx) => tx.update(localCredentials).set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null }).where(sql`lower(${localCredentials.email}) = ${who.email}`));
  }
  await withContext(db, { role: "auth" }, (tx) => tx.delete(passwordPending).where(eq(passwordPending.firebaseUid, who.uid)));
  return { message: "Password saved. Use it with your email next time you sign in." };
}
