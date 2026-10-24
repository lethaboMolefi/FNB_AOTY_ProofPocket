import { joinCompleteSchema, joinDetailsSchema } from "@proofpocket/shared";
import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { organisations } from "../db/schema/index";
import { AppError, unauthenticated } from "../lib/errors";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany } from "../repositories/companies";
import { completeJoin, saveDetails } from "../services/join";

export function joinRoutes(deps: Deps) {
  const r = Router();

  // Public: the incubators a founder can choose.
  r.get("/join/options", handle(async () => {
    const incubators = await withContext(deps.db, { role: "public" }, (tx) =>
      tx.select({ id: organisations.id, name: organisations.name }).from(organisations)
        .where(and(eq(organisations.type, "incubator"), eq(organisations.verified, true))).orderBy(asc(organisations.name)));
    return { incubators };
  }));

  // Step 1: needs a signed-in account (just created) that is either new or a founder who hasn't finished.
  r.post("/join", handle(async (req) => {
    const a = req.auth;
    if (!a) throw unauthenticated();
    if (a.user && a.user.role !== "founder") throw new AppError(409, "already_joined", "This account already has a ProofPocket portal.");
    if (!a.token.email) throw new AppError(400, "no_email", "Your account needs an email address.");
    const d = parse(joinDetailsSchema, req.body);
    const { company } = await withContext(deps.db, contextOf(req), (tx) =>
      saveDetails(tx, { firebaseUid: a.token.uid, email: a.token.email!, existingUserId: a.user?.id ?? null }, d));
    return { companyId: company.id };
  }));

  // Step 3: consent and send documents for checking.
  r.post("/join/complete", requireUser(["founder"]), handle(async (req) => {
    parse(joinCompleteSchema, req.body);
    return withContext(deps.db, contextOf(req), async (tx) => {
      const c = await myCompany(tx, req.auth!.user!.id, { joined: false });
      return completeJoin(tx, actorOf(req), c, req.auth!.token.emailVerified);
    });
  }));

  return r;
}
