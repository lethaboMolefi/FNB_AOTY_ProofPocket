// Email + password sign-in for AUTH_MODE=local (development). Production uses Firebase Authentication.
import { eq, sql } from "drizzle-orm";
import type { Config } from "../config";
import { withContext, type Db } from "../db/client";
import { localCredentials } from "../db/schema/index";
import { AppError } from "../lib/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../lib/passwords";
import { issueSessionToken } from "../lib/session-token";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const authCtx = { role: "auth" as const };

const wrongDetails = () => new AppError(401, "wrong_credentials", "That email and password don't match. Check them and try again.");
const locked = () => new AppError(429, "account_locked", `Too many wrong passwords. For your safety this account is locked for ${LOCK_MINUTES} minutes.`);

const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function signInLocal(db: Db, config: Config, email: string, password: string) {
  // Check, then commit the attempt count, then report: a failed attempt must still be recorded.
  type Outcome = { kind: "wrong" | "locked" } | { kind: "ok"; id: string; email: string };
  const outcome = await withContext(db, authCtx, async (tx): Promise<Outcome> => {
    const [cred] = await tx.select().from(localCredentials).where(sql`lower(${localCredentials.email}) = ${email.toLowerCase()}`);
    if (!cred) { await verifyPassword(password, DUMMY_HASH); return { kind: "wrong" }; }
    if (cred.lockedUntil && cred.lockedUntil > new Date()) return { kind: "locked" };
    if (!(await verifyPassword(password, cred.passwordHash))) {
      const fails = cred.failedAttempts + 1;
      await tx.update(localCredentials).set(fails >= MAX_FAILS
        ? { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedAttempts: fails }).where(eq(localCredentials.id, cred.id));
      return { kind: fails >= MAX_FAILS ? "locked" : "wrong" };
    }
    await tx.update(localCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(localCredentials.id, cred.id));
    return { kind: "ok", id: cred.id, email: cred.email.toLowerCase() };
  });
  if (outcome.kind !== "ok") throw outcome.kind === "locked" ? locked() : wrongDetails();
  return { token: issueSessionToken({ sub: outcome.id, email: outcome.email, at: nowSeconds() }, config.OTP_SECRET) };
}

export async function signUpLocal(db: Db, config: Config, email: string, password: string) {
  const hash = await hashPassword(password);
  const created = await withContext(db, authCtx, async (tx) => {
    const [exists] = await tx.select({ id: localCredentials.id }).from(localCredentials).where(sql`lower(${localCredentials.email}) = ${email.toLowerCase()}`);
    if (exists) return null;
    const [row] = await tx.insert(localCredentials).values({ email: email.toLowerCase(), passwordHash: hash }).returning();
    return row!;
  });
  if (!created) throw new AppError(409, "email_taken", "There's already an account with this email. Sign in instead.");
  return { token: issueSessionToken({ sub: created.id, email: created.email, at: nowSeconds() }, config.OTP_SECRET) };
}
