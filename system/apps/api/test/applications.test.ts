import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, FOUNDER, FUNDER_F1, newFounder, signIn, staffToken, testApp } from "./helpers";

const { app, mailer } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());

const ID = "8001015009087";
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

const funderDetails = (over: Record<string, unknown> = {}) => ({
  repName: "Sipho Dlamini", repIdNumber: ID, repRole: "Investment Manager", repEmail: "sipho@example.co.za", repPhone: "0821234567",
  orgName: `Ubuntu Ventures ${stamp()}`, entityType: "vc", website: "https://ubuntu.example.co.za", email: "info@ubuntu.example.co.za", phone: "0111234567",
  province: "Gauteng", town: "Johannesburg", physicalAddress: "1 Main Road, Sandton",
  sectors: ["Catering"], stages: ["early"], instruments: ["grant"], ticketMin: 10000, ticketMax: 200000, aumBand: "1m_10m",
  description: "Early-stage township food businesses.", ...over,
});
const orgDetails = (over: Record<string, unknown> = {}) => ({
  contactName: "Nomsa Khumalo", contactIdNumber: ID, contactRole: "Programme Manager", contactEmail: "nomsa@example.org.za", contactPhone: "0821234567",
  orgType: "ngo", orgName: `Soweto Business Hub ${stamp()}`, website: "https://hub.example.org.za", orgEmail: "info@hub.example.org.za", orgPhone: "0111234567",
  province: "Gauteng", town: "Soweto", physicalAddress: "2 Vilakazi Street", npoNumber: "123-456",
  sectors: ["Catering"], description: "Supports township founders.", foundedYear: 2015, beneficiaryGroups: ["Youth"], annualBudgetBand: "500k_2m", ...over,
});
const applicant = () => signIn(`applicant.${stamp()}@proofpocket.example`);

describe("portal applications", () => {
  it("an application grants nothing until an admin approves it", async () => {
    const who = applicant();
    const sent = await request(app).post("/api/v1/join/applications").set("Authorization", who).send({ kind: "funder", details: funderDetails() });
    expect(sent.status).toBe(200);
    expect(sent.body.message).toMatch(/Application sent/);
    // Still no account, no portal.
    expect((await request(app).get("/api/v1/me").set("Authorization", who)).body.error.code).toBe("no_account");
    expect((await request(app).get("/api/v1/funder/pipeline").set("Authorization", who)).status).toBe(403);
    const mine = await request(app).get("/api/v1/join/application").set("Authorization", who);
    expect(mine.body.application).toMatchObject({ kind: "funder", status: "pending", reason: null });
  });

  it("one application per sign-in, and not for an email that already has an account", async () => {
    const who = applicant();
    await request(app).post("/api/v1/join/applications").set("Authorization", who).send({ kind: "support_org", details: orgDetails() });
    const again = await request(app).post("/api/v1/join/applications").set("Authorization", who).send({ kind: "funder", details: funderDetails() });
    expect(again.body.error.code).toBe("already_applied");
    const existing = await request(app).post("/api/v1/join/applications").set("Authorization", signIn(FOUNDER)).send({ kind: "funder", details: funderDetails() });
    expect(existing.body.error.code).toBe("already_joined");
  });

  it("checks the ID number properly and bounds the lists", async () => {
    const bad = await request(app).post("/api/v1/join/applications").set("Authorization", applicant()).send({ kind: "funder", details: funderDetails({ repIdNumber: "8001015009088" }) });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toMatch(/Check the ID number/);
    const huge = await request(app).post("/api/v1/join/applications").set("Authorization", applicant()).send({ kind: "funder", details: funderDetails({ sectors: Array(31).fill("Catering") }) });
    expect(huge.status).toBe(400);
    const nobody = await request(app).post("/api/v1/join/applications").send({ kind: "funder", details: funderDetails() });
    expect(nobody.status).toBe(401);
  });

  it("stores the ID number encrypted and never writes it to the audit log", async () => {
    const details = funderDetails();
    await request(app).post("/api/v1/join/applications").set("Authorization", applicant()).send({ kind: "funder", details });
    const row = (await owner.query("select contact_id_number_enc, details::text as details from portal_applications where org_name = $1", [details.orgName])).rows[0];
    expect(row.contact_id_number_enc).toMatch(/^v1:/);
    expect(row.contact_id_number_enc).not.toContain(ID);
    expect(row.details).not.toContain(ID);
    const logged = (await owner.query("select count(*)::int as n from audit_log where after::text like $1", [`%${ID}%`])).rows[0];
    expect(logged.n).toBe(0);
  });

  it("the database refuses a joining sign-in that tries to approve itself", async () => {
    const c = await owner.connect();
    try {
      await c.query("begin; set local role proofpocket_app");
      await c.query("select set_config('app.role', 'joining', true), set_config('app.firebase_uid', 'dev-sneaky@proofpocket.example', true)");
      await expect(c.query("insert into portal_applications (kind, status, firebase_uid, email, contact_name, org_name, contact_id_number_enc, details) values ('funder', 'approved', 'dev-sneaky@proofpocket.example', 's@x.co', 'S', 'Sneaky', 'v1:x', '{}')"))
        .rejects.toThrow(/row-level security/);
    } finally { await c.query("rollback"); c.release(); }
  });

  it("only the admin sees the queue; it shows the ID number masked", async () => {
    expect((await request(app).get("/api/v1/admin/applications").set("Authorization", await staffToken(app, FUNDER_F1))).status).toBe(403);
    const q = await request(app).get("/api/v1/admin/applications").set("Authorization", await staffToken(app, ADMIN));
    expect(q.status).toBe(200);
    expect(q.body.applications[0].idNumber).toBe("••••••••••087");
    expect(JSON.stringify(q.body)).not.toContain(ID);
    expect((await request(app).get("/api/v1/me/counts").set("Authorization", await staffToken(app, ADMIN))).body.applications).toBeGreaterThan(0);
  });

  it("approval creates the organisation and the funder, linked, and the funder sets requirements first", async () => {
    const email = `funder.${stamp()}@proofpocket.example`;
    let who = signIn(email);
    const details = funderDetails();
    await request(app).post("/api/v1/join/applications").set("Authorization", who).send({ kind: "funder", details });
    const adm = await staffToken(app, ADMIN);
    const q = await request(app).get("/api/v1/admin/applications").set("Authorization", adm);
    const a = q.body.applications.find((x: { orgName: string }) => x.orgName === details.orgName);
    const res = await request(app).post(`/api/v1/admin/applications/${a.id}`).set("Authorization", adm).send({ decision: "approve" });
    expect(res.body.message).toMatch(/approved/);
    expect(mailer.sent.at(-1)).toMatchObject({ to: email, subject: "Your ProofPocket application was approved" });

    who = signIn(email);
    const me = await request(app).get("/api/v1/me").set("Authorization", who);
    expect(me.body).toMatchObject({ role: "funder", needsOtp: true });
    const org = (await owner.query("select o.type, o.verified, o.setup_done, o.kind, u.role from users u join organisations o on o.id = u.org_id where lower(u.email) = $1", [email])).rows[0];
    expect(org).toMatchObject({ type: "funder", verified: true, setup_done: false, kind: "Grant", role: "funder" });

    // A decision is final.
    const twice = await request(app).post(`/api/v1/admin/applications/${a.id}`).set("Authorization", adm).send({ decision: "reject", reason: "Changed our minds about this one." });
    expect(twice.body.error.code).toBe("already_decided");
  });

  it("a support organisation becomes an incubator with a lead adviser", async () => {
    const email = `hub.${stamp()}@proofpocket.example`;
    const details = orgDetails();
    await request(app).post("/api/v1/join/applications").set("Authorization", signIn(email)).send({ kind: "support_org", details });
    const adm = await staffToken(app, ADMIN);
    const a = (await request(app).get("/api/v1/admin/applications").set("Authorization", adm)).body.applications.find((x: { orgName: string }) => x.orgName === details.orgName);
    await request(app).post(`/api/v1/admin/applications/${a.id}`).set("Authorization", adm).send({ decision: "approve" });
    const row = (await owner.query("select o.type, o.verified, u.role, u.is_lead from users u join organisations o on o.id = u.org_id where lower(u.email) = $1", [email])).rows[0];
    expect(row).toMatchObject({ type: "incubator", verified: true, role: "adviser", is_lead: true });
  });

  it("turning one down needs a reason, which the applicant sees and is emailed", async () => {
    const email = `nope.${stamp()}@proofpocket.example`;
    const details = funderDetails();
    await request(app).post("/api/v1/join/applications").set("Authorization", signIn(email)).send({ kind: "funder", details });
    const adm = await staffToken(app, ADMIN);
    const a = (await request(app).get("/api/v1/admin/applications").set("Authorization", adm)).body.applications.find((x: { orgName: string }) => x.orgName === details.orgName);
    const noReason = await request(app).post(`/api/v1/admin/applications/${a.id}`).set("Authorization", adm).send({ decision: "reject" });
    expect(noReason.status).toBe(400);
    const reason = "We couldn't confirm the organisation's registration.";
    await request(app).post(`/api/v1/admin/applications/${a.id}`).set("Authorization", adm).send({ decision: "reject", reason });
    expect(mailer.sent.at(-1)).toMatchObject({ to: email, subject: "Your ProofPocket application" });
    expect(mailer.sent.at(-1)!.text).toContain(reason);
    const mine = await request(app).get("/api/v1/join/application").set("Authorization", signIn(email));
    expect(mine.body.application).toMatchObject({ status: "rejected", reason });
    expect((await request(app).get("/api/v1/me").set("Authorization", signIn(email))).body.error.code).toBe("no_account");
  });
});

describe("founder identity", () => {
  it("keeps the founder's ID number encrypted, readable by the owner's export only without it", async () => {
    const { token } = await newFounder(app, "identity");
    const exp = await request(app).get("/api/v1/founder/privacy/export").set("Authorization", token);
    expect(exp.body.founderIdentity[0]).toMatchObject({ phone: "0821234567" });
    expect(JSON.stringify(exp.body)).not.toContain(ID);
    const enc = (await owner.query("select id_number_enc from founder_identity order by created_at desc limit 1")).rows[0];
    expect(enc.id_number_enc).toMatch(/^v1:/);
  });
});
