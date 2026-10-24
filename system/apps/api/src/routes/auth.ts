import { otpRequestSchema, otpVerifySchema, signInSchema, signUpSchema, twoFactorSchema, type Me } from "@proofpocket/shared";
import { eq } from "drizzle-orm";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { users } from "../db/schema/index";
import { audit } from "../lib/audit";
import { AppError, forbidden, notFound } from "../lib/errors";
import { actorOf, contextOf, otpSatisfied, requireUser, twoFactorOn, twoFactorRequired } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { findMe } from "../repositories/users";
import { signInLocal, signUpLocal } from "../services/local-auth";
import { checkOtp, markSignInVerified, otpError, requestOtp } from "../services/otp";

export function authRoutes(deps: Deps) {
  const r = Router();

  // Development sign-in with email and password. Production uses Firebase Authentication instead.
  if (deps.config.AUTH_MODE !== "firebase") {
    r.post("/auth/local/sign-in", limits.auth(), handle(async (req) => {
      const { email, password } = parse(signInSchema, req.body);
      return signInLocal(deps.db, deps.config, email, password);
    }));
    r.post("/auth/local/sign-up", limits.auth(), handle(async (req) => {
      const { email, password } = parse(signUpSchema, req.body);
      return signUpLocal(deps.db, deps.config, email, password);
    }));
  }

  // The PIN steps work before the PIN is passed, so `otp: false`.
  r.post("/auth/otp/request", limits.auth(), requireUser(undefined, { otp: false }), handle(async (req) => {
    const { purpose } = parse(otpRequestSchema, req.body);
    const user = req.auth!.user!;
    return withContext(deps.db, contextOf(req), (tx) => requestOtp(tx, deps, user, purpose));
  }));

  r.post("/auth/otp/verify", limits.auth(), requireUser(undefined, { otp: false }), handle(async (req) => {
    const { purpose, code } = parse(otpVerifySchema, req.body);
    if (purpose !== "sign_in") throw new AppError(400, "wrong_purpose", "Enter this PIN on the screen that asked for it.");
    const user = req.auth!.user!, token = req.auth!.token;
    // Commit first so a wrong attempt is counted, then report it.
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const r = await checkOtp(tx, deps.config, user.id, purpose, code);
      if (r === "ok") await markSignInVerified(tx, user.id, token.authTime);
      return r;
    });
    if (result !== "ok") throw otpError(result);
    return { ok: true };
  }));

  // Founders turn two-step sign-in on or off. Either way needs a PIN, so a stolen password can't switch it off.
  r.post("/auth/two-factor", limits.auth(), requireUser(), handle(async (req) => {
    const { enabled, code } = parse(twoFactorSchema, req.body);
    const user = req.auth!.user!, token = req.auth!.token;
    if (twoFactorRequired(user)) throw forbidden("Two-step sign-in is always on for this account.");
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const r = await checkOtp(tx, deps.config, user.id, "two_factor", code);
      if (r !== "ok") return r;
      await tx.update(users).set({ twoFactorEnabled: enabled }).where(eq(users.id, user.id));
      // This sign-in has just passed a PIN.
      if (enabled) await markSignInVerified(tx, user.id, token.authTime);
      await audit(tx, actorOf(req), { action: enabled ? "two_factor.enabled" : "two_factor.disabled", entity: "user", entityId: user.id });
      return r;
    });
    if (result !== "ok") throw otpError(result);
    await deps.mailer.send({
      to: user.email,
      subject: enabled ? "Two-step sign-in is on" : "Two-step sign-in was turned off",
      text: enabled
        ? "Two-step sign-in is now on for your ProofPocket account. Each time you sign in, we'll email you a PIN."
        : "Two-step sign-in was turned off for your ProofPocket account. If this wasn't you, sign in, turn it back on and change your password.",
    });
    return { ok: true, enabled };
  }));

  r.get("/me", requireUser(undefined, { otp: false }), handle(async (req): Promise<Me> => {
    const { user, token } = req.auth!;
    const row = await withContext(deps.db, contextOf(req), (tx) => findMe(tx, user!.id));
    if (!row) throw notFound("Your account");
    return {
      id: row.id, email: row.email, displayName: row.displayName, role: row.role,
      org: row.orgId ? { id: row.orgId, name: row.orgName!, type: row.orgType!, verified: row.orgVerified!, setupDone: row.orgSetupDone! } : null,
      company: row.companyId
        ? { id: row.companyId, name: row.companyName!, town: row.companyTown!, province: row.companyProvince!, businessType: row.companyType!, verified: row.companyVerifiedAt !== null, joined: row.companyJoinedAt !== null }
        : null,
      needsOtp: !otpSatisfied(user!, token),
      twoFactor: { enabled: twoFactorOn(user!), required: twoFactorRequired(user!) },
    };
  }));

  return r;
}
