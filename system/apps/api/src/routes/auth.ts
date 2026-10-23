import { otpRequestSchema, otpVerifySchema, type Me } from "@proofpocket/shared";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { contextOf, otpSatisfied, requireUser } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { notFound } from "../lib/errors";
import { findMe } from "../repositories/users";
import { checkOtp, markSignInVerified, otpError, requestOtp } from "../services/otp";

export function authRoutes(deps: Deps) {
  const r = Router();

  // The PIN steps work before the PIN is passed, so `otp: false`.
  r.post("/auth/otp/request", limits.auth(), requireUser(undefined, { otp: false }), handle(async (req) => {
    const { purpose } = parse(otpRequestSchema, req.body);
    const user = req.auth!.user!;
    return withContext(deps.db, contextOf(req), (tx) => requestOtp(tx, deps, user, purpose));
  }));

  r.post("/auth/otp/verify", limits.auth(), requireUser(undefined, { otp: false }), handle(async (req) => {
    const { purpose, code } = parse(otpVerifySchema, req.body);
    const user = req.auth!.user!, token = req.auth!.token;
    // Commit first so a wrong attempt is counted, then report it.
    const result = await withContext(deps.db, contextOf(req), async (tx) => {
      const r = await checkOtp(tx, deps.config, user.id, purpose, code);
      if (r === "ok" && purpose === "sign_in") await markSignInVerified(tx, user.id, token.authTime);
      return r;
    });
    if (result !== "ok") throw otpError(result);
    return { ok: true };
  }));

  r.get("/me", requireUser(undefined, { otp: false }), handle(async (req): Promise<Me> => {
    const { user, token } = req.auth!;
    const row = await withContext(deps.db, contextOf(req), (tx) => findMe(tx, user!.id));
    if (!row) throw notFound("Your account");
    return {
      id: row.id, email: row.email, displayName: row.displayName, role: row.role,
      org: row.orgId ? { id: row.orgId, name: row.orgName!, type: row.orgType!, verified: row.orgVerified!, setupDone: row.orgSetupDone! } : null,
      companyId: row.companyId,
      needsOtp: !otpSatisfied(user!, token),
    };
  }));

  return r;
}
