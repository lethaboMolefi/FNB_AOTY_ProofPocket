import { signInSchema, signUpSchema, totpCodeSchema, type Me } from "@proofpocket/shared";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { AppError, forbidden, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { actorOf, contextOf, otpSatisfied, requireUser, twoFactorRequired } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { findMe } from "../repositories/users";
import { signInLocal, signUpLocal } from "../services/local-auth";
import { adminReset, checkCode, codeError, markSignInVerified, startSetup, turnOff } from "../services/two-factor";

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

  // ------------------------------------------------------------ Google Authenticator
  // Set-up and the sign-in code work before two-step sign-in is passed, so `otp: false`.
  const preOtp = requireUser(undefined, { otp: false });

  /** Set-up: required accounts do it at their first sign-in; founders from Business settings. */
  r.post("/auth/totp/setup", limits.auth(), preOtp, handle(async (req) => {
    const { user, token } = req.auth!;
    if (user!.totpEnabled) throw new AppError(409, "authenticator_on", "Google Authenticator is already set up for this account.");
    // A founder who hasn't turned it on is fully signed in; staff are setting it up as part of signing in.
    if (!twoFactorRequired(user!) && !otpSatisfied(user!, token)) throw forbidden();
    return withContext(deps.db, contextOf(req), (tx) => startSetup(tx, deps.config, user!));
  }));

  r.post("/auth/totp/activate", limits.auth(), preOtp, handle(async (req) => {
    const { code } = parse(totpCodeSchema, req.body);
    const { user, token } = req.auth!;
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const res = await checkCode(tx, deps.config, user!.id, code, { pending: true });
      if (res === "ok") {
        await markSignInVerified(tx, user!.id, token.authTime);
        await audit(tx, actorOf(req), { action: "two_factor.enabled", entity: "user", entityId: user!.id });
      }
      return res;
    });
    if (result !== "ok") throw codeError(result);
    await deps.mailer.send({ to: user!.email, subject: "Two-step sign-in is on", text: "Google Authenticator is now set up for your ProofPocket account. Each time you sign in, enter the code it shows for ProofPocket.\n\nIf this wasn't you, contact ProofPocket straight away." });
    return { ok: true };
  }));

  /** The code asked for after the password, on every sign-in. */
  r.post("/auth/totp/verify", limits.auth(), preOtp, handle(async (req) => {
    const { code } = parse(totpCodeSchema, req.body);
    const { user, token } = req.auth!;
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const res = await checkCode(tx, deps.config, user!.id, code);
      if (res === "ok") await markSignInVerified(tx, user!.id, token.authTime);
      return res;
    });
    if (result !== "ok") throw codeError(result);
    return { ok: true };
  }));

  /** Founders only. Needs a current code, so a stolen password can't switch it off. */
  r.post("/auth/totp/disable", limits.auth(), requireUser(), handle(async (req) => {
    const { code } = parse(totpCodeSchema, req.body);
    const user = req.auth!.user!;
    if (twoFactorRequired(user)) throw forbidden("Two-step sign-in is always on for this account.");
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const res = await checkCode(tx, deps.config, user.id, code);
      if (res === "ok") await turnOff(tx, actorOf(req), user.id);
      return res;
    });
    if (result !== "ok") throw codeError(result);
    await deps.mailer.send({ to: user.email, subject: "Two-step sign-in was turned off", text: "Google Authenticator was removed from your ProofPocket account. If this wasn't you, sign in, set it up again and change your password." });
    return { ok: true };
  }));

  /** Lost phone: the admin removes the authenticator after confirming who the person is. */
  r.post("/admin/users/:id/reset-authenticator", requireUser(["admin"]), handle(async (req) => {
    const u = await withContext(deps.db, contextOf(req), (tx) => adminReset(tx, actorOf(req), String(req.params.id)));
    await deps.mailer.send({ to: u.email, subject: "Your ProofPocket authenticator was reset", text: "A ProofPocket admin removed Google Authenticator from your account at your request. Set it up again the next time you sign in. If you didn't ask for this, contact ProofPocket straight away." });
    return { ok: true, message: `Authenticator reset for ${u.name}` };
  }));

  r.get("/me", preOtp, handle(async (req): Promise<Me> => {
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
      twoFactor: { enabled: user!.totpEnabled, required: twoFactorRequired(user!) },
    };
  }));

  return r;
}
