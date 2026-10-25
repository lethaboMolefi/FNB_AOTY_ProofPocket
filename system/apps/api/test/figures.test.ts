// The dashboard figures are what the database holds: each one is recomputed here in plain SQL (as the
// database owner, so row-level security can't hide anything) and compared with what the API shows.
import { todayZA } from "@proofpocket/shared";
import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, FOUNDER, signIn, staffToken, testApp } from "./helpers";

const { app } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());
const one = async <T>(sql: string, args: unknown[] = []) => (await owner.query(sql, args)).rows[0] as T;
const near = (a: number, b: number) => expect(Math.round(a * 100)).toBe(Math.round(b * 100));

describe("dashboard figures match the database", () => {
  it("founder Home: money in and out this month, cash on hand, proofs to check, open scams", async () => {
    const home = (await request(app).get("/api/v1/founder/home").set("Authorization", signIn(FOUNDER))).body;
    const c = await one<{ id: string; opening_balance: string; opening_balance_date: string }>(
      "select c.id, c.opening_balance, to_char(c.opening_balance_date, 'YYYY-MM-DD') as opening_balance_date from companies c join users u on u.id = c.owner_id where u.email = $1", [FOUNDER]);
    const month = todayZA().slice(0, 7);
    const m = await one<{ i: string; o: string }>(
      `select coalesce(sum(amount) filter (where direction = 'in'), 0) as i, coalesce(sum(amount) filter (where direction = 'out'), 0) as o
         from ledger_entries where company_id = $1 and voided_at is null and to_char(entry_date, 'YYYY-MM') = $2`, [c.id, month]);
    near(home.tiles.moneyIn, Number(m.i));
    near(home.tiles.moneyOut, Number(m.o));
    const cash = await one<{ net: string }>(
      `select coalesce(sum(case when direction = 'in' then amount else -amount end), 0) as net
         from ledger_entries where company_id = $1 and voided_at is null and entry_date >= $2`, [c.id, c.opening_balance_date]);
    near(home.tiles.cash, Number(c.opening_balance) + Number(cash.net));
    const checking = await one<{ n: number }>("select count(*)::int as n from payment_requests where company_id = $1 and status = 'checking'", [c.id]);
    expect(home.notices.proofsToCheck).toBe(checking.n);
    const scams = await one<{ n: number }>(
      `select (select count(*) from messages where company_id = $1 and not verified_sender and status = 'open')
            + (select count(*) from suppliers where company_id = $1 and pending_bank_masked is not null and archived_at is null) as n`, [c.id]);
    expect(home.notices.fraudOpen).toBe(Number(scams.n));
  });

  it("admin counts: documents waiting and applications waiting", async () => {
    const counts = (await request(app).get("/api/v1/me/counts").set("Authorization", await staffToken(app, ADMIN))).body;
    const apps = await one<{ n: number }>("select count(*)::int as n from portal_applications where status = 'pending'");
    expect(counts.applications).toBe(apps.n);
    const docs = await one<{ n: number }>(
      `select count(*)::int as n from documents d join companies c on c.id = d.company_id
        where d.status = 'pending' and c.incubator_id is null and c.joined_at is not null`);
    expect(counts.checks).toBe(docs.n);
  });
});
