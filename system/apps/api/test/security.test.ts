// Security regression tests (docs/security/requirements-matrix.md): each test is the automated form of one
// manual security check, so a change that reopens a hole fails CI.
import { Writable } from "node:stream";
import { sql } from "drizzle-orm";
import pg from "pg";
import { pino } from "pino";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createApp, REDACT } from "../src/app";
import { loadConfig } from "../src/config";
import { createDb } from "../src/db/client";
import { pgConfig } from "../src/db/pg-config";
import { memoryMailer } from "../src/lib/mailer";
import { localStore } from "../src/lib/storage";
import { devVerifier } from "../src/middleware/auth";
import { ADMIN, FOUNDER, FOUNDER_2, FUNDER_F1, newFounder, signIn, staffToken, testApp } from "./helpers";

const { app, db, config } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());

const PDF = (s: string) => Buffer.from(`%PDF-1.4\n% ${s}\ntrailer<<>>\n%%EOF\n`);

/** Starts an upload, PUTs the bytes and completes it. Returns the complete response. */
async function upload(token: string, data: Buffer, contentType: string, name: string, size = data.length) {
  const s = await request(app).post("/api/v1/founder/uploads").set("Authorization", token).send({ purpose: "document", name, contentType, size });
  if (s.status !== 200) return s;
  await request(app).put(s.body.upload.url).set("Content-Type", contentType).send(data);
  return request(app).post(`/api/v1/founder/uploads/${s.body.fileId}/complete`).set("Authorization", token).send({});
}

describe("RLS coverage", () => {
  it("every table has row-level security switched on", async () => {
    const r = await owner.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`);
    expect(r.rows.map((x) => x.relname), "tables without RLS").toEqual([]);
  });
  it("every table the app may read has at least one policy, except the ones reached only through functions", async () => {
    const r = await owner.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1`);
    expect(r.rows.map((x) => x.relname)).toEqual(["rate_limit_hits"]);
  });
  it("the app role can't bypass RLS", async () => {
    const r = await owner.query("select rolsuper, rolbypassrls from pg_roles where rolname = 'proofpocket_app'");
    expect(r.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});

describe("access control (IDOR and roles)", () => {
  it("a founder can't fetch another company's file by id", async () => {
    const other = (await owner.query<{ id: string }>(
      `select f.id from files f join companies c on c.id = f.company_id join users u on u.id = c.owner_id where u.email = $1 and f.sha256 is not null limit 1`, [FOUNDER_2])).rows[0]!;
    const r = await request(app).get(`/api/v1/files/${other.id}/download-url`).set("Authorization", signIn(FOUNDER));
    expect(r.status).toBe(404);
  });
  it("a founder can't open funder, adviser or admin endpoints", async () => {
    const t = signIn(FOUNDER);
    for (const path of ["/api/v1/funder/pipeline", "/api/v1/adviser/cohort", "/api/v1/admin/organisations", "/api/v1/admin/reports"]) {
      expect((await request(app).get(path).set("Authorization", t)).status, path).toBe(403);
    }
  });
  it("signed-out requests to private endpoints are refused", async () => {
    for (const path of ["/api/v1/me", "/api/v1/founder/books", "/api/v1/founder/privacy/export"]) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });
  it("a role sent by the client is ignored", async () => {
    const f = await newFounder(app, "roletamper");
    const me = await request(app).get("/api/v1/me").set("Authorization", f.token).set("X-Role", "admin").query({ role: "admin" });
    expect(me.body.role).toBe("founder");
    expect((await request(app).get("/api/v1/admin/organisations").set("Authorization", f.token).set("X-Role", "admin")).status).toBe(403);
  });
  it("a forged or tampered token is refused", async () => {
    const f = await newFounder(app, "forged");
    // Keep the real signature, change who the token says it is.
    const sig = f.token.split(".").at(-1);
    const forged = `Bearer local.${Buffer.from(JSON.stringify({ sub: "x", email: ADMIN, at: 1 })).toString("base64url")}.${sig}`;
    expect((await request(app).get("/api/v1/me").set("Authorization", forged)).status).toBe(401);
  });
  it("a funder can't open a company that hasn't shared with funders (a Starter, not an applicant)", async () => {
    const f = await newFounder(app, "unshared");
    const cid = (await owner.query<{ id: string }>("select c.id from companies c join users u on u.id = c.owner_id where u.email = $1", [f.email])).rows[0]!.id;
    const r = await request(app).get(`/api/v1/funder/companies/${cid}`).set("Authorization", await staffToken(app, FUNDER_F1));
    expect([403, 404]).toContain(r.status);
    expect(JSON.stringify(r.body)).not.toContain("Test Founder");
  });
});

describe("injection and XSS", () => {
  it("stored text comes back as JSON data, never as HTML", async () => {
    const f = await newFounder(app, "xss");
    const payload = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;
    const r = await request(app).post("/api/v1/founder/posts").set("Authorization", f.token).send({ text: payload });
    expect(r.status).toBe(200);
    const m = await request(app).get("/api/v1/founder/markets").set("Authorization", f.token);
    expect(m.headers["content-type"]).toMatch(/^application\/json/);
    expect(m.headers["x-content-type-options"]).toBe("nosniff");
    expect(JSON.stringify(m.body)).toContain("<script>alert(2)</script>");
  });
  it("SQL in input is treated as data", async () => {
    const f = await newFounder(app, "sqli");
    const r = await request(app).post("/api/v1/founder/posts").set("Authorization", f.token).send({ text: "x'); drop table companies; --" });
    expect(r.status).toBe(200);
    expect((await owner.query("select count(*)::int as n from companies")).rows[0].n).toBeGreaterThan(0);
  });
  it("malformed JSON and oversized bodies are refused cleanly", async () => {
    const t = signIn(FOUNDER);
    const bad = await request(app).post("/api/v1/founder/posts").set("Authorization", t).set("Content-Type", "application/json").send("{bad");
    expect(bad.body.error.code).toBe("bad_json");
    const big = await request(app).post("/api/v1/founder/posts").set("Authorization", t).send({ text: "x".repeat(200_000) });
    expect(big.status).toBe(413);
  });
  it("API responses carry the security headers", async () => {
    const r = await request(app).get("/api/v1/health");
    expect(r.headers["x-powered-by"]).toBeUndefined();
    expect(r.headers["strict-transport-security"]).toMatch(/max-age=/);
    expect(r.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(r.headers["content-security-policy"]).toMatch(/default-src 'self'/);
  });
});

describe("malicious uploads", () => {
  it("refuses HTML, SVG and programs whatever their name or declared type", async () => {
    const f = await newFounder(app, "upload");
    const cases: [Buffer, string, string][] = [
      [Buffer.from("<html><script>alert(1)</script></html>"), "application/pdf", "id.pdf"],
      [Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`), "image/png", "id.png"],
      [Buffer.from("MZ\x90\x00 this is a Windows program"), "image/jpeg", "id.jpg"],
    ];
    for (const [data, type, name] of cases) expect((await upload(f.token, data, type, name)).body.error?.code, name).toBe("file_type");
  });
  it("refuses files over 5 MB and bytes that don't match the signed size", async () => {
    const f = await newFounder(app, "upload-size");
    const big = await request(app).post("/api/v1/founder/uploads").set("Authorization", f.token).send({ purpose: "document", name: "big.pdf", contentType: "application/pdf", size: 6 * 1024 * 1024 });
    expect(big.status).toBe(400);
    const s = await request(app).post("/api/v1/founder/uploads").set("Authorization", f.token).send({ purpose: "document", name: "a.pdf", contentType: "application/pdf", size: 10 });
    const put = await request(app).put(s.body.upload.url).set("Content-Type", "application/pdf").send(PDF("longer than ten bytes"));
    expect(put.body.error.code).toBe("upload_mismatch");
  });
  it("serves an accepted file only as a sandboxed download", async () => {
    const f = await newFounder(app, "polyglot");
    // Starts like a PDF (so it's accepted) but carries HTML: it must never render in our origin.
    const done = await upload(f.token, Buffer.from("%PDF-1.4\n<html><script>alert(1)</script></html>"), "application/pdf", "poly.pdf");
    expect(done.status).toBe(200);
    const link = await request(app).get(`/api/v1/files/${done.body.fileId}/download-url`).set("Authorization", f.token);
    const file = await request(app).get(link.body.url);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(file.headers["content-disposition"]).toMatch(/^attachment;/);
    expect(file.headers["content-security-policy"]).toBe("default-src 'none'; sandbox");
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("link expiry", () => {
  afterEach(() => { vi.useRealTimers(); });
  it("download links stop working after 5 minutes", async () => {
    const f = await newFounder(app, "expiry");
    const done = await upload(f.token, PDF("expiry"), "application/pdf", "e.pdf");
    const link = await request(app).get(`/api/v1/files/${done.body.fileId}/download-url`).set("Authorization", f.token);
    expect(link.body.expiresInSeconds).toBe(300);
    expect((await request(app).get(link.body.url)).status).toBe(200);
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 301_000 });
    expect((await request(app).get(link.body.url)).status).toBe(403);
  });
  it("a tampered link is refused", async () => {
    const f = await newFounder(app, "tamper");
    const done = await upload(f.token, PDF("tamper"), "application/pdf", "t.pdf");
    const link = await request(app).get(`/api/v1/files/${done.body.fileId}/download-url`).set("Authorization", f.token);
    const [body, sig] = (link.body.url as string).split("/").at(-1)!.split(".");
    const changed = Buffer.from(Buffer.from(body!, "base64url").toString().replace(/"exp":\d+/, `"exp":9999999999`)).toString("base64url");
    expect((await request(app).get(`/api/v1/storage/${changed}.${sig}`)).status).toBe(403);
  });
});

describe("rate limits", () => {
  it("sign-in attempts are counted across API instances (Postgres store)", async () => {
    const prev = process.env.AUTH_RATE_LIMIT;
    process.env.AUTH_RATE_LIMIT = "3";
    const cfg = { ...loadConfig(), RATE_LIMIT_STORE: "postgres" as const };
    const make = () => {
      const { pool, db } = createDb(cfg.DATABASE_URL);
      return { pool, app: createApp({ config: cfg, db, log: pino({ level: "silent" }), mailer: memoryMailer(), verify: devVerifier(cfg.OTP_SECRET), store: localStore(cfg) }) };
    };
    const a = make(), b = make();
    try {
      await owner.query("delete from rate_limit_hits where key like 'auth:%'");
      const tryIt = (x: typeof a) => request(x.app).post("/api/v1/auth/local/sign-in").send({ email: "nobody@proofpocket.example", password: "wrong password here" });
      expect((await tryIt(a)).status).toBe(401);
      expect((await tryIt(b)).status).toBe(401);
      expect((await tryIt(a)).status).toBe(401);
      const blocked = await tryIt(b);
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe("rate_limited");
    } finally {
      if (prev === undefined) delete process.env.AUTH_RATE_LIMIT; else process.env.AUTH_RATE_LIMIT = prev;
      await owner.query("delete from rate_limit_hits");
      await a.pool.end(); await b.pool.end();
    }
  });
  it("the app role can't read or change the counters directly", async () => {
    const rows = await db.execute(sql`select * from rate_limit_hits`);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("audit log integrity", () => {
  it("is hash-chained, and an edit made even with owner rights is detected", async () => {
    const ok = (await owner.query("select * from audit_log_verify()")).rows[0];
    expect(ok.first_broken_seq).toBeNull();
    expect(ok.head_hash).toMatch(/^[0-9a-f]{64}$/);
    const victim = (await owner.query<{ id: string; action: string }>("select id, action from audit_log order by chain_seq limit 1 offset 1")).rows[0]!;
    await owner.query("alter table audit_log disable trigger audit_log_no_change");
    try {
      await owner.query("update audit_log set action = 'rewritten' where id = $1", [victim.id]);
      const broken = (await owner.query("select * from audit_log_verify()")).rows[0];
      expect(Number(broken.first_broken_seq)).toBe(2);
    } finally {
      await owner.query("update audit_log set action = $2 where id = $1", [victim.id, victim.action]);
      await owner.query("alter table audit_log enable trigger audit_log_no_change");
    }
    expect((await owner.query("select * from audit_log_verify()")).rows[0].first_broken_seq).toBeNull();
  });
  it("only admins may run the check through the API role", async () => {
    await expect(db.execute(sql`select * from audit_log_verify()`)).rejects.toThrow();
  });
});

describe("logs", () => {
  it("never contain tokens, passwords, account or ID numbers", async () => {
    const lines: string[] = [];
    const sink = new Writable({ write(chunk, _enc, cb) { lines.push(String(chunk)); cb(); } });
    const log = pino({ level: "info", redact: { paths: REDACT, censor: "[hidden]" } }, sink);
    const logged = createApp({ config, db, log, mailer: memoryMailer(), verify: devVerifier(config.OTP_SECRET), store: localStore(config) });
    const token = signIn(FOUNDER);
    await request(logged).get("/api/v1/me").set("Authorization", token).set("Cookie", "session=secret-cookie");
    await request(logged).post("/api/v1/auth/local/sign-in").send({ email: "x@proofpocket.example", password: "my secret passphrase" });
    await request(logged).put("/api/v1/founder/payment-details").set("Authorization", token).send({ accountNumber: "62000012345", idNumber: "9001015009087", code: "123456" });
    const all = lines.join("\n");
    expect(all.length).toBeGreaterThan(0);
    for (const secret of [token.slice(7), "secret-cookie", "my secret passphrase", "62000012345", "9001015009087"]) expect(all).not.toContain(secret);
  });
});

describe("privacy (POPIA access, correction and deletion)", () => {
  it("a founder downloads their own data, without storage paths or encrypted values", async () => {
    const r = await request(app).get("/api/v1/founder/privacy/export").set("Authorization", signIn(FOUNDER));
    expect(r.status).toBe(200);
    expect(r.headers["content-disposition"]).toMatch(/^attachment; filename="proofpocket-my-data-/);
    expect(r.body.company.name).toBe("Nala Nails & Lashes");
    expect(r.body.ledgerEntries.length).toBeGreaterThan(0);
    const text = JSON.stringify(r.body);
    for (const hidden of ["bucketPath", "accountNumberEnc", "Mama Tau"]) expect(text).not.toContain(hidden);
  });
  it("a correction or deletion request reaches the admin's reports", async () => {
    const f = await newFounder(app, "dsr");
    const r = await request(app).post("/api/v1/founder/privacy/requests").set("Authorization", f.token).send({ kind: "deletion", details: "Closing the business" });
    expect(r.body.message).toBe("Sent. ProofPocket will reply within 30 days.");
    const reports = await request(app).get("/api/v1/admin/reports").set("Authorization", await staffToken(app, ADMIN));
    expect(reports.body.reports.find((x: { reason: string }) => x.reason === "Delete my data: Closing the business")).toMatchObject({ target: "data_request", status: "open" });
  });
  it("records which privacy notice the founder agreed to", async () => {
    const f = await newFounder(app, "consent");
    const r = await owner.query("select c.consent_version from companies c join users u on u.id = c.owner_id where u.email = $1", [f.email]);
    expect(r.rows[0].consent_version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("configuration", () => {
  it("production refuses per-instance rate limits", () => {
    expect(() => loadConfig({ ...process.env, NODE_ENV: "production", AUTH_MODE: "firebase", FIREBASE_PROJECT_ID: "p", MAIL_MODE: "smtp", SMTP_USER: "u", SMTP_PASS: "p", STORAGE_MODE: "gcs", GCS_BUCKET: "b", RATE_LIMIT_STORE: "memory" }))
      .toThrow(/RATE_LIMIT_STORE/);
  });
  it("database connections verify the server certificate when a CA is given", () => {
    const pem = Buffer.from("-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n").toString("base64");
    const c = pgConfig("postgres://u:p@10.0.0.3:5432/db?sslmode=no-verify", pem);
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(() => pgConfig("postgres://u:p@h/db", Buffer.from("nope").toString("base64"))).toThrow(/PEM/);
    expect(pgConfig("postgres://u:p@h/db", undefined)).toEqual({ connectionString: "postgres://u:p@h/db" });
  });
});
