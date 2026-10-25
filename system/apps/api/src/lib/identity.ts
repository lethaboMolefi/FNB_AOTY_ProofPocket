// Sign-in accounts for people an admin invites (funders, advisers, buyers).
// Production: a Firebase Authentication user plus a "set your password" link. Development: a local password.
import { getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { eq, sql } from "drizzle-orm";
import type { Config } from "../config";
import { withContext, type Db } from "../db/client";
import { localCredentials } from "../db/schema/index";
import { generatePassword, hashPassword } from "./passwords";

/** Returns the instructions to email to the person. Never logged. */
export async function createLogin(db: Db, config: Config, email: string, displayName: string): Promise<string> {
  if (config.AUTH_MODE === "firebase") {
    const auth = getAuth(getApps()[0]);
    try { await auth.getUserByEmail(email); }
    catch { await auth.createUser({ email, emailVerified: true, displayName, password: generatePassword() }); }
    const link = await auth.generatePasswordResetLink(email, { url: config.PUBLIC_WEB_URL });
    return `Set your password with this link (it works once): ${link}`;
  }
  const password = generatePassword();
  const hash = await hashPassword(password);
  await withContext(db, { role: "auth" }, async (tx) => {
    const [row] = await tx.select({ id: localCredentials.id }).from(localCredentials).where(sql`lower(${localCredentials.email}) = ${email.toLowerCase()}`);
    if (row) await tx.update(localCredentials).set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null }).where(eq(localCredentials.id, row.id));
    else await tx.insert(localCredentials).values({ email: email.toLowerCase(), passwordHash: hash });
  });
  return `Your temporary password is ${password}.`;
}
