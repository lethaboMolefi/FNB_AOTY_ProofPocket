// The public directory and business profiles (no account). Only public columns, through checked functions.
import { reportSchema } from "@proofpocket/shared";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { reports } from "../db/schema/index";
import { notFound } from "../lib/errors";
import { handle, limits, parse } from "../middleware/http";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/);

export function publicRoutes(deps: Deps) {
  const r = Router();
  const pub = <T>(fn: Parameters<typeof withContext<T>>[2]) => withContext(deps.db, { role: "public" }, fn);

  r.get("/public/directory", handle(async () => pub(async (tx) => ({
    businesses: (await tx.execute<{ slug: string; name: string; sector: string; town: string; province: string; tagline: string }>(sql`select * from public_directory()`)).rows,
    featured: (await tx.execute<{ slug: string; name: string; town: string; text: string; posted_on: string }>(sql`select * from public_featured()`)).rows
      .map((f) => ({ slug: f.slug, name: f.name, town: f.town, text: f.text, date: f.posted_on })),
  }))));

  r.get("/public/b/:slug", handle(async (req) => {
    const slug = parse(slugSchema, req.params.slug);
    const row = await pub(async (tx) => (await tx.execute<{ slug: string; name: string; sector: string; town: string; province: string; founded_year: number; verified: boolean; tagline: string; services: string; whatsapp: string; instagram: string; hours: string }>(sql`select * from public_profile(${slug})`)).rows[0]);
    if (!row) throw notFound("That business");
    return { slug: row.slug, name: row.name, sector: row.sector, town: row.town, province: row.province, foundedYear: row.founded_year, verified: row.verified,
      tagline: row.tagline, services: row.services, whatsapp: row.whatsapp, instagram: row.instagram, hours: row.hours };
  }));

  r.post("/public/b/:slug/report", limits.pay(), handle(async (req) => {
    const slug = parse(slugSchema, req.params.slug);
    const { reason } = parse(reportSchema, req.body ?? {});
    await pub(async (tx) => {
      const row = (await tx.execute<{ company_id: string }>(sql`select company_id from public_profile(${slug})`)).rows[0];
      if (!row) throw notFound("That business");
      await tx.insert(reports).values({ targetType: "company", targetId: row.company_id, companyId: row.company_id, reason });
    });
    return { message: "Thanks. ProofPocket will review this business within two working days." };
  }));
  return r;
}
