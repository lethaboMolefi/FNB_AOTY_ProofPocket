import { eq } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, organisations, users } from "../db/schema/index";
import { AppError } from "../lib/errors";

export type CompanyRow = typeof companies.$inferSelect;

/** The signed-in founder's company. `joined: true` (the default) also requires the Join wizard to be finished. */
export async function myCompany(tx: Tx, ownerId: string, opts: { joined?: boolean } = {}): Promise<CompanyRow> {
  const [c] = await tx.select().from(companies).where(eq(companies.ownerId, ownerId));
  if (!c) throw new AppError(403, "no_company", "Finish joining ProofPocket first.");
  if ((opts.joined ?? true) && !c.joinedAt) throw new AppError(403, "join_unfinished", "Finish joining ProofPocket first.");
  return c;
}

export async function incubatorName(tx: Tx, id: string | null) {
  if (!id) return null;
  const [o] = await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, id));
  return o?.name ?? null;
}

export async function ownerOf(tx: Tx, companyId: string) {
  const [r] = await tx.select({ email: users.email, name: users.displayName }).from(companies).innerJoin(users, eq(users.id, companies.ownerId)).where(eq(companies.id, companyId));
  return r ?? null;
}
