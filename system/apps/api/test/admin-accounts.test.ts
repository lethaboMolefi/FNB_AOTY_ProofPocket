import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { adminRows, generateTempPassword, setLocalPassword } from "../src/db/admin-accounts";
import { assertDemoDatabase } from "../src/db/demo-reset";
import { parseTestCases } from "../src/routes/testing";
import { ADMIN, FOUNDER, FUNDER_F1, signIn, staffToken, testApp } from "./helpers";

const { app, mailer } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());

const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
const signInLocal = (email: string, password: string) => request(app).post("/api/v1/auth/local/sign-in").send({ email, password });
const bearer = (r: { body: { token: string } }) => `Bearer ${r.body.token}`;

/** A new admin with a temporary password, as the operator's command makes one locally. */
async function newTempAdmin() {
  const email = `temp.admin.${stamp()}@proofpocket.example`;
  const [r] = await adminRows(owner, [email]);
  expect(r).toEqual({ email, status: "created" });
  const temp = generateTempPassword();
  await setLocalPassword(owner, email, temp);
  return { email, temp };
}

describe("admin accounts with temporary passwords", () => {
  it("temporary passwords are long, mixed and unique", () => {
    const all = Array.from({ length: 200 }, () => generateTempPassword());
    expect(new Set(all).size).toBe(200);
    for (const p of all) {
      expect(p.length).toBeGreaterThanOrEqual(14);
      for (const re of [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]) expect(p).toMatch(re);
    }
  });

  it("are idempotent: existing emails are skipped, never overwritten", async () => {
    const before = (await owner.query("select role, must_change_password from users where email = $1", [ADMIN])).rows[0];
    const { email } = await newTempAdmin();
    const again = await adminRows(owner, [email, ADMIN, FOUNDER]);
    expect(again.map((r) => r.status)).toEqual(["skipped", "skipped", "skipped"]);
    expect(again[2]!.note).toBe("already has a founder account");
    expect((await owner.query("select role, must_change_password from users where email = $1", [ADMIN])).rows[0]).toEqual(before);
    const row = (await owner.query("select must_change_password, temp_password_expires_at from users where email = $1", [email])).rows[0];
    expect(row.must_change_password).toBe(true);
    const days = (new Date(row.temp_password_expires_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9); expect(days).toBeLessThanOrEqual(7);
  });

  it("store only a hash, never the password", async () => {
    const { email, temp } = await newTempAdmin();
    const stored = (await owner.query("select password_hash from local_credentials where lower(email) = $1", [email])).rows[0].password_hash as string;
    expect(stored).toMatch(/^scrypt\$/);
    expect(stored).not.toContain(temp);
  });

  it("must be changed before anything else; then the temporary password no longer works", async () => {
    const { email, temp } = await newTempAdmin();
    const first = await signInLocal(email, temp);
    expect(first.status).toBe(200);
    const token = bearer(first);
    const me = await request(app).get("/api/v1/me").set("Authorization", token);
    expect(me.body.mustChangePassword).toBe(true);
    // Nothing else, not even Google Authenticator set-up.
    for (const [m, p] of [["get", "/admin/overview"], ["get", "/admin/approvals"], ["post", "/auth/totp/setup"], ["get", "/uml"]] as const) {
      expect((await request(app)[m](`/api/v1${p}`).set("Authorization", token).send({})).body.error.code).toBe("password_change_required");
    }
    const change = (current: string, password: string) => request(app).post("/api/v1/auth/password").set("Authorization", token).send({ current, password });
    expect((await change(temp, "short")).body.error.code).toBe("weak_password");
    expect((await change(temp, temp)).body.error.code).toBe("same_password");
    expect((await change("not-the-temporary-one", "a brand new long passphrase")).body.error.code).toBe("current_wrong");
    expect((await change(temp, "a brand new long passphrase")).status).toBe(200);
    // The temporary password is gone; the new one works, and Google Authenticator set-up comes next.
    expect((await signInLocal(email, temp)).status).toBe(401);
    const next = await signInLocal(email, "a brand new long passphrase");
    expect(next.status).toBe(200);
    const me2 = await request(app).get("/api/v1/me").set("Authorization", bearer(next));
    expect(me2.body).toMatchObject({ mustChangePassword: false, needsOtp: true, role: "admin" });
    expect((await request(app).get("/api/v1/admin/overview").set("Authorization", bearer(next))).body.error.code).toBe("otp_required");
    expect((await owner.query("select count(*)::int as n from audit_log where action = 'user.password_changed' and entity_id = (select id::text from users where email = $1)", [email])).rows[0].n).toBe(1);
  });

  it("expire after 7 days, and an operator can re-issue them", async () => {
    const { email, temp } = await newTempAdmin();
    await owner.query("update users set temp_password_expires_at = now() - interval '1 minute' where email = $1", [email]);
    const token = bearer(await signInLocal(email, temp));
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body.error.code).toBe("temp_password_expired");
    expect((await request(app).post("/api/v1/auth/password").set("Authorization", token).send({ current: temp, password: "a brand new long passphrase" })).body.error.code).toBe("temp_password_expired");
    const [r] = await adminRows(owner, [email], { reissue: true });
    expect(r!.status).toBe("reissued");
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body.mustChangePassword).toBe(true);
    // Admins who already chose their own password aren't re-issued one.
    expect((await adminRows(owner, [ADMIN], { reissue: true }))[0]).toMatchObject({ status: "skipped", note: "has already set their own password" });
  });

  it("a password can't be set on an old sign-in", async () => {
    const { email, temp } = await newTempAdmin();
    // A dev token with an old auth_time stands in for a sign-in from hours ago.
    expect((await request(app).post("/api/v1/auth/password").set("Authorization", signIn(email)).send({ current: temp, password: "a brand new long passphrase" })).body.error.code).toBe("sign_in_again");
  });
});

const ID = "8001015009087";
const funderDetails = () => ({
  repName: "Sipho Dlamini", repIdNumber: ID, repRole: "Investment Manager", repEmail: "sipho@example.co.za", repPhone: "0821234567",
  orgName: `Approval Ventures ${stamp()}`, entityType: "vc", website: "https://ubuntu.example.co.za", email: "info@ubuntu.example.co.za", phone: "0111234567",
  province: "Gauteng", town: "Johannesburg", physicalAddress: "1 Main Road, Sandton",
  sectors: ["Catering"], stages: ["early"], instruments: ["grant"], ticketMin: 10000, ticketMax: 200000, aumBand: "1m_10m", description: "Food businesses.",
});

describe("user approvals", () => {
  const admin = () => staffToken(app, ADMIN);
  const get = async (p: string) => request(app).get(`/api/v1${p}`).set("Authorization", await admin());
  const post = async (p: string, body: object = {}) => request(app).post(`/api/v1${p}`).set("Authorization", await admin()).send(body);
  const idOf = async (email: string) => (await owner.query("select id from users where lower(email) = $1", [email])).rows[0].id as string;

  it("lists everyone who isn't a founder, and refuses founders, other admins and yourself", async () => {
    const list = (await get("/admin/approvals")).body.items as { email: string; role: string; canAct: boolean; type: string }[];
    expect(list.some((i) => i.role === "founder")).toBe(false);
    expect(list.find((i) => i.email === FUNDER_F1)).toMatchObject({ type: "user", canAct: true });
    expect(list.find((i) => i.email === ADMIN)).toMatchObject({ role: "admin", canAct: false });
    const founder = await idOf(FOUNDER);
    expect((await get(`/admin/approvals/user/${founder}`)).status).toBe(403);
    expect((await post(`/admin/approvals/user/${founder}/suspend`, { reason: "Testing the founder rule" })).status).toBe(403);
    expect((await post(`/admin/approvals/user/${await idOf(ADMIN)}/suspend`, { reason: "Testing the self rule" })).body.error.message).toBe("You can't change your own account here.");
    const other = (await newTempAdmin()).email;
    expect((await post(`/admin/approvals/user/${await idOf(other)}/suspend`, { reason: "Testing the admin rule" })).body.error.message).toBe("Admin accounts can't be changed by another admin.");
  });

  it("approve and reject applications (a reason is required), with emails and a founder-visible summary", async () => {
    const send = async () => {
      const who = signIn(`applicant.${stamp()}@proofpocket.example`);
      const d = funderDetails();
      expect((await request(app).post("/api/v1/join/applications").set("Authorization", who).send({ kind: "funder", details: d })).status).toBe(200);
      const items = (await get(`/admin/approvals?status=pending&q=${encodeURIComponent(d.orgName)}`)).body.items;
      expect(items).toHaveLength(1);
      return { who, item: items[0] as { id: string; email: string; type: string }, org: d.orgName };
    };
    const a = await send();
    const detail = (await get(`/admin/approvals/application/${a.item.id}`)).body;
    expect(detail.details.idNumber).toBe("••••••••••087");
    expect(JSON.stringify(detail)).not.toContain(ID);
    expect((await post(`/admin/approvals/application/${a.item.id}`, { decision: "approve" })).status).toBe(200);
    expect((await request(app).get("/api/v1/me").set("Authorization", a.who)).body.role).toBe("funder");
    expect(mailer.sent.at(-1)).toMatchObject({ to: a.item.email, subject: "Your ProofPocket application was approved" });

    const b = await send();
    expect((await post(`/admin/approvals/application/${b.item.id}`, { decision: "reject", reason: "short" })).status).toBe(400);
    expect((await post(`/admin/approvals/application/${b.item.id}`, { decision: "reject", reason: "We couldn't confirm the organisation's registration." })).status).toBe(200);
    expect((await request(app).get("/api/v1/me").set("Authorization", b.who)).body.error.code).toBe("no_account");
    expect(mailer.sent.at(-1)!.text).toContain("We couldn't confirm the organisation's registration.");

    // Founders see the decisions, without names, emails or reasons.
    const log = (await request(app).get("/api/v1/admin-log").set("Authorization", signIn(FOUNDER))).body.entries as { action: string; organisation: string; role: string }[];
    expect(log).toEqual(expect.arrayContaining([{ at: expect.any(String), action: "Approved", role: "funder", organisation: a.org }, { at: expect.any(String), action: "Turned down", role: "funder", organisation: b.org }]));
    const raw = JSON.stringify(log);
    expect(raw).not.toContain("@");
    expect(raw).not.toContain("registration");
    expect((await request(app).get("/api/v1/admin-log").set("Authorization", await staffToken(app, FUNDER_F1))).status).toBe(403);
  });

  it("suspend (reason required) shuts an account out until it's reinstated", async () => {
    const email = `buyer.${stamp()}@proofpocket.example`;
    const org = (await owner.query("select id from organisations where type = 'buyer' limit 1")).rows[0].id;
    await owner.query("insert into users (email, display_name, role, org_id) values ($1, 'Test Buyer', 'buyer', $2)", [email, org]);
    const id = await idOf(email);
    const buyer = signIn(email);
    expect((await request(app).get("/api/v1/me").set("Authorization", buyer)).status).toBe(200);
    expect((await post(`/admin/approvals/user/${id}/suspend`, { reason: "too short" })).status).toBe(400);
    expect((await post(`/admin/approvals/user/${id}/suspend`, { reason: "Reported for asking founders for upfront fees." })).status).toBe(200);
    expect(mailer.sent.at(-1)).toMatchObject({ to: email, subject: "Your ProofPocket account is suspended" });
    expect((await request(app).get("/api/v1/me").set("Authorization", buyer)).body.error.code).toBe("account_suspended");
    expect((await get(`/admin/approvals?status=suspended`)).body.items.some((i: { email: string }) => i.email === email)).toBe(true);
    // The database refuses it too: a buyer can't lift their own suspension, and founders can't be suspended at all.
    await expect(owner.query("update users set suspended_at = now() where email = $1", [FOUNDER])).rejects.toThrow(/can't be suspended/);
    expect((await post(`/admin/approvals/user/${id}/reinstate`)).status).toBe(200);
    expect((await request(app).get("/api/v1/me").set("Authorization", buyer)).status).toBe(200);
    const actions = (await owner.query("select action, actor_role from audit_log where entity_id = $1 order by id", [id])).rows;
    expect(actions).toEqual([{ action: "user.suspended", actor_role: "admin" }, { action: "user.reinstated", actor_role: "admin" }]);
  });
});

describe("UML diagrams", () => {
  it("every diagram has an up-to-date drawing (re-run pnpm --filter @proofpocket/web uml:render after editing a .mmd)", async () => {
    const { createHash } = await import("node:crypto");
    const { readFileSync, existsSync } = await import("node:fs");
    const index = JSON.parse(readFileSync("uml/index.json", "utf8")) as { id: string }[];
    const manifest = JSON.parse(readFileSync("uml/rendered/manifest.json", "utf8")) as Record<string, string>;
    for (const { id } of index) {
      expect(manifest[id], `${id} drawn from its current source`).toBe(createHash("sha256").update(readFileSync(`uml/${id}.mmd`, "utf8")).digest("hex"));
      for (const ext of ["svg", "png", "pdf"]) expect(existsSync(`uml/rendered/${id}.${ext}`), `${id}.${ext}`).toBe(true);
    }
  });

  it("founders and admins can list and download them; everyone else is refused", async () => {
    const list = await request(app).get("/api/v1/uml").set("Authorization", signIn(FOUNDER));
    expect(list.status).toBe(200);
    const ids = list.body.diagrams.map((d: { id: string }) => d.id);
    for (const id of ["use-case-diagram", "domain-class-diagram", "entity-relationship-diagram", "component-diagram", "deployment-diagram", "joining-and-document-upload", "funder-or-ngo-registration-and-admin-approval", "funding-apply-offer-and-decision"]) expect(ids).toContain(id);
    const admin = await staffToken(app, ADMIN);
    const src = await request(app).get("/api/v1/uml/use-case-diagram/source").set("Authorization", admin);
    expect(src.status).toBe(200);
    expect(src.headers["content-disposition"]).toBe('attachment; filename="use-case-diagram.mmd"');
    expect(src.text).toMatch(/^flowchart/);
    for (const [format, type, magic] of [["svg", "image/svg+xml", "<svg"], ["png", "image/png", "\x89PNG"], ["pdf", "application/pdf", "%PDF-"]] as const) {
      const r = await request(app).get(`/api/v1/uml/entity-relationship-diagram/${format}`).set("Authorization", admin).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on("data", (x: Buffer) => c.push(x)); res.on("end", () => cb(null, Buffer.concat(c))); });
      expect(r.status).toBe(200);
      expect(r.headers["content-type"]).toContain(type);
      expect((r.body as Buffer).subarray(0, 5).toString("latin1")).toContain(magic === "\x89PNG" ? "PNG" : magic);
    }
    expect((await request(app).get("/api/v1/uml/use-case-diagram/exe").set("Authorization", admin)).status).toBe(400);
    expect((await request(app).get("/api/v1/uml/use-case-diagram/png").set("Authorization", await staffToken(app, FUNDER_F1))).status).toBe(403);
    expect((await request(app).get("/api/v1/uml/..%2Fpackage/source").set("Authorization", signIn(FOUNDER))).status).toBe(400);
    expect((await request(app).get("/api/v1/uml").set("Authorization", await staffToken(app, FUNDER_F1))).status).toBe(403);
    expect((await request(app).get("/api/v1/uml/use-case-diagram/source")).status).toBe(401);
  });
});

describe("demo reset", () => {
  it("refuses any database with data that isn't marked as the demo", async () => {
    await expect(assertDemoDatabase(owner)).rejects.toThrow(/isn't marked as the demo/);
  });
});

describe("testing page", () => {
  it("reads every test case from TEST-CASES.md", async () => {
    const { readFileSync } = await import("node:fs");
    const cases = parseTestCases(readFileSync("../../../docs/TEST-CASES.md", "utf8"));
    expect(cases.length).toBeGreaterThan(500);
    expect(cases.find((c) => c.id === "MON-11")).toMatchObject({ section: "Admin monitoring", result: "Pass", role: "Admin" });
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });
  it("is for admins only; the demo password is never on the demo site itself", async () => {
    const r = await request(app).get("/api/v1/testing").set("Authorization", await staffToken(app, ADMIN));
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("documents");
    expect((await request(app).get("/api/v1/testing").set("Authorization", signIn(FOUNDER))).status).toBe(403);
    expect((await request(app).get("/api/v1/testing/documents/../../etc").set("Authorization", await staffToken(app, ADMIN))).status).toBe(404);
  });
});
