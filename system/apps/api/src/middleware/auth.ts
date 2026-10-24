// Verifies the Firebase ID token and loads the user. Roles always come from the database, never the client.
import { OTP_ROLES, type Role } from "@proofpocket/shared";
import { sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Db, DbContext } from "../db/client";
import { AppError, forbidden, unauthenticated } from "../lib/errors";
import { readSessionToken } from "../lib/session-token";

export interface VerifiedToken { uid: string; email: string | null; emailVerified: boolean; authTime: number }
export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

export interface AuthUser { id: string; role: Role; orgId: string | null; email: string; displayName: string; otpVerifiedAuthTime: number | null; twoFactorEnabled: boolean }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { token: VerifiedToken; user: AuthUser | null };
    }
  }
}

export function firebaseVerifier(projectId: string): TokenVerifier {
  const app = getApps()[0] ?? initializeApp({ projectId, credential: applicationDefault() });
  const auth = getAuth(app);
  return async (token) => {
    const d = await auth.verifyIdToken(token, true);
    return { uid: d.uid, email: d.email ?? null, emailVerified: d.email_verified === true, authTime: d.auth_time };
  };
}

/** AUTH_MODE=local: tokens issued by POST /auth/local/sign-in (development only; refused in production). */
export function localVerifier(secretB64: string): TokenVerifier {
  return async (token) => {
    const c = readSessionToken(token, secretB64);
    return { uid: `local-${c.sub}`, email: c.email, emailVerified: true, authTime: c.at };
  };
}

/**
 * Automated tests only (config refuses it outside NODE_ENV=test). Accepts "dev:<email>:<authTime>",
 * and local tokens so the password sign-in can be tested too.
 */
export function devVerifier(secretB64: string): TokenVerifier {
  const local = localVerifier(secretB64);
  return async (token) => {
    if (token.startsWith("local.")) return local(token);
    const m = /^dev:([^:\s]+@[^:\s]+):(\d+)$/.exec(token);
    if (!m) throw new Error("bad dev token");
    const email = m[1]!.toLowerCase();
    return { uid: `dev-${email}`, email, emailVerified: true, authTime: Number(m[2]) };
  };
}

/** Reads the bearer token if there is one. Routes decide whether a user is required. */
export function authenticate(db: Db, verify: TokenVerifier) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) return next();
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    let verified: VerifiedToken;
    try {
      verified = await verify(token);
    } catch {
      return next(new AppError(401, "invalid_token", "Your sign-in has expired. Sign in again."));
    }
    try {
      const rows = await db.execute<{ user_id: string; user_role: Role; org_id: string | null; email: string; display_name: string; otp_verified_auth_time: string | null; two_factor_enabled: boolean }>(
        sql`select * from auth_lookup_user(${verified.uid}, ${verified.email}, ${verified.emailVerified})`,
      );
      const u = rows.rows[0];
      req.auth = {
        token: verified,
        user: u ? { id: u.user_id, role: u.user_role, orgId: u.org_id, email: u.email, displayName: u.display_name, otpVerifiedAuthTime: u.otp_verified_auth_time === null ? null : Number(u.otp_verified_auth_time), twoFactorEnabled: u.two_factor_enabled } : null,
      };
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Funder, adviser and admin accounts always use two-step sign-in; founders choose to. */
export const twoFactorRequired = (user: Pick<AuthUser, "role">) => OTP_ROLES.includes(user.role);
export const twoFactorOn = (user: Pick<AuthUser, "role" | "twoFactorEnabled">) => twoFactorRequired(user) || user.twoFactorEnabled;

/** With two-step sign-in on, each sign-in (token auth_time) must pass an email PIN. */
export const otpSatisfied = (user: AuthUser, token: VerifiedToken) =>
  !twoFactorOn(user) || user.otpVerifiedAuthTime === token.authTime;

export function requireUser(roles?: Role[], opts: { otp?: boolean } = {}) {
  const checkOtp = opts.otp ?? true;
  return (req: Request, _res: Response, next: NextFunction) => {
    const a = req.auth;
    if (!a) return next(unauthenticated());
    if (!a.user) return next(new AppError(403, "no_account", "Finish joining ProofPocket first."));
    if (roles && !roles.includes(a.user.role)) return next(forbidden());
    if (checkOtp && !otpSatisfied(a.user, a.token)) return next(new AppError(403, "otp_required", "Enter the PIN we emailed you to continue."));
    next();
  };
}

/** A signed-in Firebase user without a ProofPocket account yet (the Join wizard). */
export function requireJoining(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthenticated());
  if (req.auth.user) return next(new AppError(409, "already_joined", "You already have a ProofPocket account."));
  next();
}

export function contextOf(req: Request): DbContext {
  const a = req.auth;
  if (a?.user) return { role: a.user.role, userId: a.user.id };
  if (a) return { role: "joining", firebaseUid: a.token.uid };
  return { role: "public" };
}

export const actorOf = (req: Request) => ({ userId: req.auth?.user?.id ?? null, role: req.auth?.user?.role ?? "public", requestId: String(req.id ?? "") });
