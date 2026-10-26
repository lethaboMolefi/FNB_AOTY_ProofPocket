import { newPasswordSchema, passwordFor, PRIVACY_NOTICE_VERSION, signInSchema, signUpSchema, totpCodeSchema, type Me } from "@proofpocket/shared";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { AppError, forbidden, notFound, unauthenticated } from "../lib/errors";
import { audit } from "../lib/audit";
import { actorOf, contextOf, otpSatisfied, requireUser, twoFactorRequired } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { findMe } from "../repositories/users";
import { sendEmailCode, verifyEmailCode } from "../services/email-code";
import { signInLocal, signUpLocal } from "../services/local-auth";
import { setOwnPassword } from "../lib/identity";
import { sql } from "drizzle-orm";
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
    await deps.mailer.send({ to: user.email, subject: "Two-step sign-in was turned off", text: "Google Authenticator was removed from your ProofPocket account. If this wasn't you, sign in, set it up again and change your password.", action: { label: "Sign in", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } });
    return { ok: true };
  }));

  /** Lost phone: the admin removes the authenticator after confirming who the person is. */
  r.post("/admin/users/:id/reset-authenticator", requireUser(["admin"]), handle(async (req) => {
    const u = await withContext(deps.db, contextOf(req), (tx) => adminReset(tx, actorOf(req), String(req.params.id)));
    await deps.mailer.send({ to: u.email, subject: "Your ProofPocket authenticator was reset", text: "A ProofPocket admin removed Google Authenticator from your account at your request. Set it up again the next time you sign in. If you didn't ask for this, contact ProofPocket straight away.", action: { label: "Sign in", url: `${deps.config.PUBLIC_WEB_URL}/sign-in` } });
    return { ok: true, message: `Authenticator reset for ${u.name}` };
  }));

  // Set your own password: required first after a temporary one (before Google Authenticator), or any time from
  // your profile (then with the Authenticator code). Only on a fresh sign-in.
  r.post("/auth/password", limits.auth(), requireUser(undefined, { otp: false, passwordChange: true }), handle(async (req) => {
    const { current, password } = parse(newPasswordSchema, req.body);
    const { user, token } = req.auth!;
    if (user!.tempPassword !== "must_change" && !otpSatisfied(user!, token)) throw new AppError(403, "otp_required", "Enter the code from Google Authenticator to continue.");
    if (Date.now() / 1000 - token.authTime > 15 * 60) throw new AppError(403, "sign_in_again", "For your safety, sign in again before changing your password.");
    const rule = passwordFor(user!.email).safeParse(password);
    if (!rule.success) throw new AppError(400, "weak_password", rule.error.issues[0]!.message);
    if (password === current) throw new AppError(400, "same_password", "Choose a new password, not the one you have now.");
    await setOwnPassword(deps.db, deps.config, { email: user!.email, firebaseUid: token.uid }, current, password);
    await withContext(deps.db, contextOf(req), async (tx) => {
      await tx.execute(sql`select password_changed()`);
      await audit(tx, actorOf(req), { action: "user.password_changed", entity: "user", entityId: user!.id });
    });
    return { message: "Password changed. Sign in again with your new password." };
  }));

  // Confirm the sign-in's email with a 6-digit code (sign-up, and Join for anyone not confirmed yet). Needs a sign-in,
  // not an account. Google sign-ins (and local ones) are already confirmed.
  const unconfirmed = (req: import("express").Request) => {
    const a = req.auth;
    if (!a) throw unauthenticated();
    if (!a.token.email) throw new AppError(400, "no_email", "Your sign-in has no email address.");
    return { uid: a.token.uid, email: a.token.email.toLowerCase(), confirmed: a.token.emailVerified };
  };
  r.post("/auth/email-code/send", limits.auth(), handle(async (req) => {
    const who = unconfirmed(req);
    if (who.confirmed) return { sent: false, confirmed: true, message: "Your email is already confirmed." };
    const { resend } = parse(z.object({ resend: z.boolean().default(false) }), req.body ?? {});
    return { confirmed: false, ...(await sendEmailCode(deps.db, deps.mailer, who, { resend })) };
  }));
  r.post("/auth/email-code/verify", limits.auth(), handle(async (req) => {
    const who = unconfirmed(req);
    if (who.confirmed) return { message: "Your email is already confirmed." };
    const { code } = parse(z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }), req.body);
    return verifyEmailCode(deps.db, deps.config, who, code);
  }));

  r.get("/me", requireUser(undefined, { otp: false, passwordChange: true }), handle(async (req): Promise<Me> => {
    const { user, token } = req.auth!;
    const row = await withContext(deps.db, contextOf(req), (tx) => findMe(tx, user!.id));
    if (!row) throw notFound("Your account");
    return {
      id: row.id, email: row.email, displayName: row.displayName, role: row.role,
      org: row.orgId ? { id: row.orgId, name: row.orgName!, type: row.orgType!, verified: row.orgVerified!, setupDone: row.orgSetupDone! } : null,
      company: row.companyId
        ? { id: row.companyId, name: row.companyName!, town: row.companyTown!, province: row.companyProvince!, businessType: row.companyType!, verified: row.companyVerifiedAt !== null, joined: row.companyJoinedAt !== null, privacyNoticeCurrent: row.companyConsentVersion === PRIVACY_NOTICE_VERSION }
        : null,
      needsOtp: !otpSatisfied(user!, token),
      twoFactor: { enabled: user!.totpEnabled, required: twoFactorRequired(user!) },
      mustChangePassword: user!.tempPassword === "must_change",
    };
  }));

  return r;
}
