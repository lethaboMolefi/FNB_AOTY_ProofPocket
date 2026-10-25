// The red counts on each portal's navigation (v2/app.js renderRail counts).
import { fraudOpen, JOIN_DOCS, lowStock, STARTER_FLAG } from "@proofpocket/shared";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { applications, portalApplications } from "../db/schema/index";
import { contextOf, requireUser } from "../middleware/auth";
import { handle } from "../middleware/http";
import { myCompany } from "../repositories/companies";
import { attention } from "../services/adviser";
import { reviewQueue } from "../services/documents";
import { loadSnapshot } from "../services/snapshot";

export function countRoutes(deps: Deps) {
  const r = Router();
  r.get("/me/counts", requireUser(), handle((req) => withContext(deps.db, contextOf(req), async (tx): Promise<Record<string, number>> => {
    const u = req.auth!.user!;
    if (u.role === "founder") {
      const c = await myCompany(tx, u.id);
      const s = await loadSnapshot(tx, c.id);
      return {
        start: c.verifiedAt ? 0 : JOIN_DOCS.filter((k) => s.docs[k] !== "verified").length,
        stock: lowStock(s.stock).length,
        payments: s.paymentRequests.filter((p) => p.status === "checking").length,
        protection: fraudOpen(s),
      };
    }
    if (u.role === "adviser") {
      const a = await attention(tx, u.orgId);
      return { checks: (await reviewQueue(tx, "adviser")).length, attention: a.items.filter((f) => f.level === "bad" && f.code !== STARTER_FLAG).length };
    }
    if (u.role === "funder" && u.orgId) {
      const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(applications).where(and(eq(applications.funderId, u.orgId), inArray(applications.status, ["submitted", "under_review"])));
      return { applications: n!.n };
    }
    if (u.role === "admin") {
      const [{ n }] = await tx.select({ n: count() }).from(portalApplications).where(eq(portalApplications.status, "pending")) as [{ n: number }];
      return { checks: (await reviewQueue(tx, "admin")).length, applications: n };
    }
    return {};
  })));
  return r;
}
