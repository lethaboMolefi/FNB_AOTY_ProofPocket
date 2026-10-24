// Security review fixes (docs/security): each test proves one hole is closed at the database layer.
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { withContext, type DbContext } from "../src/db/client";
import { applications, companies, offers, organisations, paymentRequests, profiles } from "../src/db/schema/index";
import { ADVISER_N1, FOUNDER, FOUNDER_2, FUNDER_F1, testApp } from "./helpers";

const { db } = testApp();
async function ctxFor(email: string): Promise<DbContext> {
  const r = await db.execute<{ user_id: string; user_role: DbContext["role"] }>(sql`select * from auth_lookup_user(${"dev-" + email}, ${email}, true)`);
  return { role: r.rows[0]!.user_role, userId: r.rows[0]!.user_id };
}
const as = async <T>(email: string, fn: Parameters<typeof withContext<T>>[2]) => withContext(db, await ctxFor(email), fn);
async function refused(p: Promise<unknown>, pattern: RegExp) {
  const err = await p.then(() => null, (e: unknown) => e as Error & { cause?: Error });
  expect(err, "expected the database to refuse").not.toBeNull();
  expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(pattern);
}

describe("public context", () => {
  it("sees no companies or profiles without a payment request", async () => {
    await withContext(db, { role: "public" }, async (tx) => {
      expect(await tx.select().from(companies)).toHaveLength(0);
      expect(await tx.select().from(profiles)).toHaveLength(0);
    });
  });
  it("on a payment page sees only that request's company", async () => {
    const lerato = await as(FOUNDER, async (tx) => (await tx.select().from(paymentRequests).where(eq(paymentRequests.ref, "PP-4821")))[0]!);
    await withContext(db, { role: "public", payRequestId: lerato.id }, async (tx) => {
      expect((await tx.select({ name: companies.name }).from(companies)).map((c) => c.name)).toEqual(["Nala Nails & Lashes"]);
    });
  });
  it("can only move its request to checking", async () => {
    const lerato = await as(FOUNDER, async (tx) => (await tx.select().from(paymentRequests).where(eq(paymentRequests.ref, "PP-4821")))[0]!);
    await refused(withContext(db, { role: "public", payRequestId: lerato.id }, (tx) =>
      tx.update(paymentRequests).set({ amount: "1.00" }).where(eq(paymentRequests.id, lerato.id))), /can only send a proof/);
    await refused(withContext(db, { role: "public", payRequestId: lerato.id }, (tx) =>
      tx.update(paymentRequests).set({ status: "paid" }).where(eq(paymentRequests.id, lerato.id))), /can only send a proof/);
  });
  it("directory functions return only Verified companies' public columns", async () => {
    const rows = await withContext(db, { role: "public" }, async (tx) => (await tx.execute<{ name: string }>(sql`select * from public_directory()`)).rows);
    expect(rows.map((r) => r.name)).not.toContain("Nala Nails & Lashes");
    expect(Object.keys(rows[0]!).sort()).toEqual(["name", "province", "sector", "slug", "tagline", "town"]);
  });
});

describe("protected columns", () => {
  it("a funder can't verify its own organisation", async () => {
    const ctx = await ctxFor(FUNDER_F1);
    await refused(withContext(db, ctx, async (tx) => {
      const [u] = await tx.execute<{ org_id: string }>(sql`select org_id from users where id = ${ctx.userId}`).then((r) => r.rows);
      await tx.update(organisations).set({ verified: false }).where(eq(organisations.id, u!.org_id));
    }), /only an admin/);
  });
  it("a founder can't verify their own company or move their support stage", async () => {
    await refused(as(FOUNDER, (tx) => tx.update(companies).set({ verifiedAt: new Date() }).where(sql`true`)), /only a document check/);
    await refused(as(FOUNDER, (tx) => tx.update(companies).set({ supportStage: 4 }).where(sql`true`)), /only the incubator/);
  });
  it("an adviser can't change a founder's sharing", async () => {
    await refused(as(ADVISER_N1, (tx) => tx.update(companies).set({ funderSharing: "full" }).where(sql`true`)), /only the founder/);
  });
});

describe("offer history", () => {
  it("a changed offer needs a reason, and offers can't be edited", async () => {
    const ctx = await ctxFor(FUNDER_F1);
    const palesa = await ctxFor(FOUNDER_2);
    const app = await withContext(db, palesa, async (tx) => (await tx.select().from(applications))[0]!);
    await refused(withContext(db, ctx, (tx) => tx.insert(offers).values({ applicationId: app.id, amount: "1000.00", reason: "" })), /needs a reason/);
    // No UPDATE policy: an edit changes nothing (and the trigger refuses even the table owner).
    const changed = await withContext(db, ctx, (tx) => tx.update(offers).set({ reason: "rewritten" }).where(eq(offers.applicationId, app.id)).returning());
    expect(changed).toHaveLength(0);
    const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
    try { await refused(owner.query("update offers set reason = 'rewritten' where application_id = $1", [app.id]), /append-only/); }
    finally { await owner.end(); }
  });
});
