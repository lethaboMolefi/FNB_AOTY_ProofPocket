import { investorDetailsSchema, joinCompleteSchema, joinDetailsSchema, orgOnboardSchema } from "@proofpocket/shared";
import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { organisations, users } from "../db/schema/index";
import { AppError, unauthenticated } from "../lib/errors";
import { audit, addActivity } from "../lib/audit";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { myCompany } from "../repositories/companies";
import { completeJoin, saveDetails } from "../services/join";

export function joinRoutes(deps: Deps) {
  const r = Router();

  // ── Public: options the join wizard needs ─────────────────────────────────
  r.get("/join/options", handle(async () => {
    const incubators = await withContext(deps.db, { role: "public" }, (tx) =>
      tx.select({ id: organisations.id, name: organisations.name }).from(organisations)
        .where(and(eq(organisations.type, "incubator"), eq(organisations.verified, true))).orderBy(asc(organisations.name)));
    return { incubators };
  }));

  // ── Founder track ─────────────────────────────────────────────────────────
  // Step 1: save founder + business details (creates account if needed).
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

  // ── Investor / Funder track ───────────────────────────────────────────────
  // Saves an investor application for admin review. Does not create a user yet.
  r.post("/join/investor", handle(async (req) => {
    const a = req.auth;
    if (!a) throw unauthenticated();
    if (a.user) throw new AppError(409, "already_joined", "This account already has a ProofPocket portal.");
    if (!a.token.email) throw new AppError(400, "no_email", "Your account needs an email address.");
    const d = parse(investorDetailsSchema, req.body);

    await withContext(deps.db, contextOf(req), async (tx) => {
      // Create the user account, pending admin approval.
      const [u] = await tx.insert(users).values({
        firebaseUid: a.token.uid,
        email: a.token.email!,
        displayName: d.repName,
        role: "funder",
      }).returning({ id: users.id });

      // Create the organisation record (not verified until admin approves).
      await tx.insert(organisations).values({
        type: "funder",
        name: d.orgName,
        kind: d.instruments.join(", "),
        verified: false,
        setupDone: false,
      });

      await audit(tx, { userId: u!.id, role: "funder", requestId: undefined }, {
        action: "investor.applied",
        entity: "user",
        entityId: u!.id,
        after: { orgName: d.orgName, entityType: d.entityType, repEmail: d.repEmail },
      });
    });

    return { ok: true, message: "Application received. We will contact you within 2–3 business days to complete verification." };
  }));

  // ── Incubator / NGO / NPO track ───────────────────────────────────────────
  // Saves an org application for admin review and manual validation.
  r.post("/join/org", handle(async (req) => {
    const a = req.auth;
    if (!a) throw unauthenticated();
    if (a.user) throw new AppError(409, "already_joined", "This account already has a ProofPocket portal.");
    if (!a.token.email) throw new AppError(400, "no_email", "Your account needs an email address.");
    const d = parse(orgOnboardSchema, req.body);

    // Map the orgOnboard type to the DB orgType enum.
    const dbType = (d.orgType === "ngo" || d.orgType === "npo" || d.orgType === "cbo") ? "incubator" as const : "incubator" as const;
    // (The DB currently uses 'incubator' for all support orgs; a migration will add ngo/npo later.)

    await withContext(deps.db, contextOf(req), async (tx) => {
      const [u] = await tx.insert(users).values({
        firebaseUid: a.token.uid,
        email: a.token.email!,
        displayName: d.contactName,
        role: "adviser",
      }).returning({ id: users.id });

      await tx.insert(organisations).values({
        type: dbType,
        name: d.orgName,
        verified: false,
        setupDone: false,
      });

      await audit(tx, { userId: u!.id, role: "adviser", requestId: undefined }, {
        action: "org.applied",
        entity: "user",
        entityId: u!.id,
        after: {
          orgName: d.orgName,
          orgType: d.orgType,
          contactEmail: d.contactEmail,
          contactPhone: d.contactPhone,
          website: d.website,
          npoNumber: d.npoNumber,
          cipcNumber: d.cipcNumber,
        },
      });
    });

    return { ok: true, message: "Application received. Our team will call the number you provided within 2–3 business days to verify your organisation." };
  }));

  return r;
}
