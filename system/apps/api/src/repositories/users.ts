import { eq } from "drizzle-orm";
import type { Tx } from "../db/client";
import { companies, organisations, users } from "../db/schema/index";

export async function findMe(tx: Tx, userId: string) {
  const [row] = await tx
    .select({
      id: users.id, email: users.email, displayName: users.displayName, role: users.role,
      orgId: organisations.id, orgName: organisations.name, orgType: organisations.type, orgVerified: organisations.verified, orgSetupDone: organisations.setupDone,
      companyId: companies.id, companyName: companies.name, companyTown: companies.town, companyProvince: companies.province,
      companyType: companies.businessType, companyVerifiedAt: companies.verifiedAt,
    })
    .from(users)
    .leftJoin(organisations, eq(organisations.id, users.orgId))
    .leftJoin(companies, eq(companies.ownerId, users.id))
    .where(eq(users.id, userId));
  return row ?? null;
}
