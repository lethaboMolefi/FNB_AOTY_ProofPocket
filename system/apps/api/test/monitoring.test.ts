import { todayZA } from "@proofpocket/shared";
import pg from "pg";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { runJobs } from "../src/jobs";
import { createMailer } from "../src/lib/mailer";
import { recordEmailFailure } from "../src/services/monitoring";
import { ADMIN, FOUNDER, FUNDER_F1, newFounder, signIn, staffToken, testApp } from "./helpers";

const { app, db, config } = testApp();
const owner = () => new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
const get = async (path: string) => request(app).get(`/api/v1${path}`).set("Authorization", await staffToken(app, ADMIN));

describe("admin monitoring", () => {
  it("only admins can see it", async () => {
    for (const path of ["/admin/overview", "/admin/activity", "/admin/people", "/admin/companies", "/admin/health"]) {
      expect((await request(app).get(`/api/v1${path}`).set("Authorization", signIn(FOUNDER))).status).toBe(403);
      expect((await request(app).get(`/api/v1${path}`).set("Authorization", await staffToken(app, FUNDER_F1))).status).toBe(403);
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
    }
  });

  it("overview totals match the database", async () => {
    const res = await get("/admin/overview");
    expect(res.status).toBe(200);
    const pool = owner();
    try {
      const q = async (s: string, p: unknown[] = []) => Number((await pool.query(s, p)).rows[0].n);
      expect(res.body.founders.verified).toBe(await q("select count(*) as n from companies where verified_at is not null"));
      expect(res.body.founders.starters).toBe(await q("select count(*) as n from companies where joined_at is not null and verified_at is null"));
      expect(res.body.users).toBe(await q("select count(*) as n from users"));
      expect(res.body.organisations.funders).toBe(await q("select count(*) as n from organisations where type = 'funder'"));
      expect(res.body.waiting.reports).toBe(await q("select count(*) as n from reports where status = 'open'"));
      const month = todayZA().slice(0, 7);
      expect(res.body.money.moneyIn).toBeCloseTo(await q("select coalesce(sum(amount), 0) as n from ledger_entries where voided_at is null and direction = 'in' and to_char(entry_date, 'YYYY-MM') = $1", [month]), 2);
    } finally { await pool.end(); }
    expect(res.body.trend).toHaveLength(30);
    expect(res.body.trend.at(-1).day).toBe(todayZA());
  });

  it("people show two-step status, and last seen is updated at most every 5 minutes", async () => {
    const f = await newFounder(app, "seen");
    await request(app).get("/api/v1/me").set("Authorization", f.token);
    const pool = owner();
    try {
      const first = (await pool.query("select last_seen_at from users where email = $1", [f.email])).rows[0].last_seen_at;
      expect(first).not.toBeNull();
      await request(app).get("/api/v1/me").set("Authorization", f.token);
      expect((await pool.query("select last_seen_at from users where email = $1", [f.email])).rows[0].last_seen_at).toEqual(first);
      await pool.query("update users set last_seen_at = now() - interval '10 minutes' where email = $1", [f.email]);
      await request(app).get("/api/v1/me").set("Authorization", f.token);
      expect((await pool.query("select last_seen_at from users where email = $1", [f.email])).rows[0].last_seen_at.getTime()).toBeGreaterThan(first.getTime() - 1);
    } finally { await pool.end(); }
    const res = await get(`/admin/people?q=${encodeURIComponent(f.email)}`);
    expect(res.body.people).toHaveLength(1);
    expect(res.body.people[0]).toMatchObject({ email: f.email, role: "founder", twoFactor: "off" });
    expect(res.body.people[0].lastSeenAt).not.toBeNull();
    const admins = await get("/admin/people?role=admin");
    expect(admins.body.people.find((p: { email: string }) => p.email === ADMIN).twoFactor).toBe("on");
  });

  it("companies list and opening one is recorded in the activity log", async () => {
    const list = await get("/admin/companies?status=verified");
    expect(list.status).toBe(200);
    expect(list.body.companies.length).toBeGreaterThan(0);
    const c = list.body.companies[0];
    expect(c.status).toBe("verified");
    expect(typeof c.score).toBe("number");
    const open = await get(`/admin/companies/${c.id}`);
    expect(open.status).toBe(200);
    expect(open.body.company.name).toBe(c.name);
    const log = await get(`/admin/activity?action=admin.company_viewed&company=${encodeURIComponent(c.name)}`);
    expect(log.body.entries[0]).toMatchObject({ action: "admin.company_viewed", person: ADMIN, company: c.name });
    expect(log.body.chain).toMatchObject({ intact: true });
    expect(log.body.actionGroups).toContain("admin");
  });

  it("activity pages through the log", async () => {
    // Enough rows for two pages of 50 (the test database starts fresh).
    const pool = owner();
    try { await pool.query("insert into audit_log (actor_role, action, entity) select 'system', 'test.filler', 'test' from generate_series(1, 60)"); }
    finally { await pool.end(); }
    const p0 = await get("/admin/activity?action=test.");
    const p1 = await get("/admin/activity?action=test.&page=1");
    expect(p0.body.entries).toHaveLength(50);
    expect(p0.body.more).toBe(true);
    expect(p1.body.chain).toBeNull();
    expect(p1.body.entries.length).toBeGreaterThanOrEqual(10);
    expect(Number(p1.body.entries[0].id)).toBeLessThan(Number(p0.body.entries.at(-1).id));
    // Wildcards typed into a filter are matched literally.
    expect((await get("/admin/activity?action=%25")).body.entries).toHaveLength(0);
  });

  it("jobs and failed emails show on the health page (no email address stored)", async () => {
    await runJobs(process.env.DATABASE_OWNER_URL!, null, { rehash: false });
    const mailer = createMailer({ ...config, MAIL_MODE: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: 1, SMTP_USER: "x", SMTP_PASS: "x" }, pino({ level: "silent" }), recordEmailFailure(db));
    await mailer.send({ to: "someone.private@example.com", subject: "Monitoring test email", text: "Hello" });
    const res = await get("/admin/health");
    expect(res.status).toBe(200);
    expect(res.body.jobs.find((j: { kind: string }) => j.kind === "daily").result).toMatchObject({ auditChainOk: true });
    expect(res.body.emailFailures.recent[0].subject).toBe("Monitoring test email");
    expect(JSON.stringify(res.body)).not.toContain("someone.private");
    expect(res.body.chain.intact).toBe(true);
    expect(res.body.database.reachable).toBe(true);
  });
});
