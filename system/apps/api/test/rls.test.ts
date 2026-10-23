// Row-level security, tested directly against Postgres as the restricted app role.
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withContext, type DbContext } from "../src/db/client";
import { auditLog, companies, ledgerEntries, paymentDetails, paymentRequests, users } from "../src/db/schema/index";
import { ADMIN, ADVISER_N1, FOUNDER, FOUNDER_2, FUNDER_F1, testApp } from "./helpers";

const { db } = testApp();

async function ctxFor(email: string): Promise<DbContext> {
  const r = await db.execute<{ user_id: string; user_role: DbContext["role"] }>(sql`select * from auth_lookup_user(${"dev-" + email}, ${email}, true)`);
  const u = r.rows[0]!;
  return { role: u.user_role, userId: u.user_id };
}
const as = async <T>(email: string, fn: Parameters<typeof withContext<T>>[2]) => withContext(db, await ctxFor(email), fn);
const names = (rows: { name: string }[]) => rows.map((r) => r.name).sort();
/** Drizzle wraps Postgres errors ("Failed query: …"); the database's own message is the cause. */
async function rejectsWith(p: Promise<unknown>, pattern: RegExp) {
  const err = await p.then(() => null, (e: unknown) => e as Error & { cause?: Error });
  expect(err, "expected the database to refuse").not.toBeNull();
  expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(pattern);
}

describe("row-level security", () => {
  it("without context the app role sees nothing", async () => {
    expect(await db.select().from(companies)).toHaveLength(0);
    expect(await db.select().from(ledgerEntries)).toHaveLength(0);
  });

  it("a founder sees only their own company and its books", async () => {
    await as(FOUNDER, async (tx) => {
      expect(names(await tx.select({ name: companies.name }).from(companies))).toEqual(["Nala Nails & Lashes"]);
      const entries = await tx.select().from(ledgerEntries);
      expect(entries).toHaveLength(6);
      expect(new Set(entries.map((e) => e.companyId)).size).toBe(1);
    });
  });

  it("a founder can't write into another company's books", async () => {
    const other = await as(FOUNDER_2, async (tx) => (await tx.select({ id: companies.id }).from(companies))[0]!.id);
    await rejectsWith(as(FOUNDER, (tx) => tx.insert(ledgerEntries).values({
      companyId: other, clientUuid: crypto.randomUUID(), entryDate: "2026-10-01", direction: "in", amount: "10.00", method: "cash", category: "Sales",
    })), /row-level security/);
  });

  it("an adviser sees their incubator's cohort only", async () => {
    await as(ADVISER_N1, async (tx) => {
      expect(names(await tx.select({ name: companies.name }).from(companies))).toEqual(["Khanya Solar Installs", "Mabele AgriLink", "Nala Nails & Lashes"]);
    });
  });

  it("a funder sees Verified, sharing companies, never Starters", async () => {
    await as(FUNDER_F1, async (tx) => {
      const seen = names(await tx.select({ name: companies.name }).from(companies));
      expect(seen).not.toContain("Nala Nails & Lashes");
      expect(seen).toEqual(["Green Route Waste Services", "Khanya Solar Installs", "Mabele AgriLink", "Mama Tau Catering", "ReKasi Plastics"]);
    });
  });

  it("a funder sees no companies with sharing 'none', unless they applied to that funder", async () => {
    const owner = async (email: string) => (await ctxFor(email)).userId!;
    // Mabele (no application to Lesedi) and ReKasi (applied to Lesedi) both switch sharing off.
    await as(FOUNDER_2, (tx) => tx.update(companies).set({ funderSharing: "none" }).where(sql`true`));
    await as("tumelo@proofpocket.example", (tx) => tx.update(companies).set({ funderSharing: "none" }).where(sql`true`));
    try {
      await as(FUNDER_F1, async (tx) => {
        const seen = names(await tx.select({ name: companies.name }).from(companies));
        expect(seen).not.toContain("Mabele AgriLink");
        expect(seen).toContain("ReKasi Plastics");
        // Applicant with sharing 'none' is summary-level: no book entries.
        const rekasi = await owner(FOUNDER_2);
        const [c] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, rekasi));
        expect(await tx.select().from(ledgerEntries).where(eq(ledgerEntries.companyId, c!.id))).toHaveLength(0);
      });
    } finally {
      await as(FOUNDER_2, (tx) => tx.update(companies).set({ funderSharing: "full" }).where(sql`true`));
      await as("tumelo@proofpocket.example", (tx) => tx.update(companies).set({ funderSharing: "full" }).where(sql`true`));
    }
  });

  it("a funder reads book entries only with full sharing", async () => {
    await as(FUNDER_F1, async (tx) => {
      const rows = await tx.select({ name: companies.name, n: sql<number>`count(${ledgerEntries.id})::int` })
        .from(companies).leftJoin(ledgerEntries, eq(ledgerEntries.companyId, companies.id)).groupBy(companies.name);
      const by = Object.fromEntries(rows.map((r) => [r.name, r.n]));
      expect(by["Mama Tau Catering"]).toBe(0); // summary
      expect(by["ReKasi Plastics"]).toBe(5); // full
    });
  });

  it("payment details are private to the founder and admin", async () => {
    await as(FUNDER_F1, async (tx) => expect(await tx.select().from(paymentDetails)).toHaveLength(0));
    await as(ADVISER_N1, async (tx) => expect(await tx.select().from(paymentDetails)).toHaveLength(0));
    await as(FOUNDER, async (tx) => expect(await tx.select().from(paymentDetails)).toHaveLength(1));
    await as(ADMIN, async (tx) => expect((await tx.select().from(paymentDetails)).length).toBe(6));
  });

  it("the payment page sees only its own request", async () => {
    const owner = await ctxFor(FOUNDER);
    const reqs = await withContext(db, owner, (tx) => tx.select().from(paymentRequests));
    const lerato = reqs.find((r) => r.ref === "PP-4821")!;
    await withContext(db, { role: "public", payRequestId: lerato.id }, async (tx) => {
      expect((await tx.select().from(paymentRequests)).map((r) => r.ref)).toEqual(["PP-4821"]);
      expect(await tx.select().from(paymentDetails)).toHaveLength(1);
      expect(await tx.select().from(ledgerEntries)).toHaveLength(0);
    });
  });

  it("users can't change their own role, organisation or email", async () => {
    await rejectsWith(as(FOUNDER, (tx) => tx.update(users).set({ role: "admin" }).where(sql`true`)), /only an admin/);
    await rejectsWith(as(ADVISER_N1, (tx) => tx.update(users).set({ isLead: false }).where(sql`true`)), /only an admin/);
    // Harmless self-edits still work.
    await expect(as(FOUNDER, (tx) => tx.update(users).set({ displayName: "Zanele M." }).where(sql`true`))).resolves.toBeDefined();
  });

  it("audit_log is append-only", async () => {
    await as(ADMIN, (tx) => tx.insert(auditLog).values({ action: "test", entity: "test" }));
    await rejectsWith(as(ADMIN, (tx) => tx.update(auditLog).set({ action: "changed" })), /permission denied/);
    await rejectsWith(as(ADMIN, (tx) => tx.delete(auditLog)), /permission denied/);
  });
});
