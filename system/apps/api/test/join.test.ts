import request from "supertest";
import { describe, expect, it } from "vitest";
import { ADMIN, ADVISER_N1, signIn, testApp } from "./helpers";

const { app, mailer } = testApp();
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
const pinFrom = (t: string) => /\b(\d{6})\b/.exec(t)![1]!;

/** Sign up with a password, as the Join wizard does. */
async function signUp(email: string) {
  const r = await request(app).post("/api/v1/auth/local/sign-up").send({ email, password: "a long and lovely passphrase" });
  expect(r.status).toBe(200);
  return `Bearer ${r.body.token}`;
}

/** Staff tokens need the email PIN first. */
async function staff(email: string) {
  const t = signIn(email);
  await request(app).post("/api/v1/auth/otp/request").set("Authorization", t).send({ purpose: "sign_in" });
  await request(app).post("/api/v1/auth/otp/verify").set("Authorization", t).send({ purpose: "sign_in", code: pinFrom(mailer.sent.at(-1)!.text) });
  return t;
}

async function upload(token: string, docType: string, bytes = PDF, contentType = "application/pdf", name = `${docType}.pdf`) {
  const start = await request(app).post("/api/v1/founder/uploads").set("Authorization", token).send({ purpose: "document", name, contentType, size: bytes.length });
  expect(start.status).toBe(200);
  const put = await request(app).put(start.body.upload.url).set("Content-Type", contentType).send(bytes);
  expect(put.status).toBe(200);
  const done = await request(app).post(`/api/v1/founder/uploads/${start.body.fileId}/complete`).set("Authorization", token).send({});
  if (done.status !== 200) return done;
  return request(app).post("/api/v1/founder/documents").set("Authorization", token).send({ docType, fileId: start.body.fileId });
}

const details = (over: Record<string, unknown> = {}) => ({
  founderName: "Lindiwe K.", businessName: "Lindi's Kitchen", businessType: "food", sector: "Catering", town: "Khayelitsha",
  province: "Western Cape", area: "township", incubatorId: null, registered: true, legalName: "Lindi's Kitchen (Pty) Ltd", cipcNumber: "2025/481516/07", ...over,
});

describe("join, documents and the admin checker", () => {
  let founder: string;
  let admin: string;

  it("creates the account and an unfinished company", async () => {
    founder = await signUp("lindiwe@proofpocket.example");
    expect((await request(app).get("/api/v1/me").set("Authorization", founder)).body.error.code).toBe("no_account");
    const bad = await request(app).post("/api/v1/join").set("Authorization", founder).send(details({ cipcNumber: "2025-48" }));
    expect(bad.body.error.message).toMatch(/2024\/123456\/07/);
    const r = await request(app).post("/api/v1/join").set("Authorization", founder).send(details());
    expect(r.status).toBe(200);
    const me = await request(app).get("/api/v1/me").set("Authorization", founder);
    expect(me.body).toMatchObject({ role: "founder", company: { name: "Lindi's Kitchen (Pty) Ltd", joined: false, verified: false } });
  });

  it("can't finish joining without the four documents", async () => {
    const r = await request(app).post("/api/v1/join/complete").set("Authorization", founder).send({ agree: true });
    expect(r.body.error.code).toBe("documents_missing");
  });

  it("checks file type by signature, not by name", async () => {
    const fake = await upload(founder, "cipc", Buffer.from("MZ this is really a program"), "application/pdf", "cipc.pdf");
    expect(fake.body.error.code).toBe("file_type");
  });

  it("fingerprints each upload with SHA-256 and finishes joining", async () => {
    const r = await upload(founder, "cipc");
    expect(r.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.body.message).toBe("Uploaded. A ProofPocket checker will check it.");
    for (const k of ["id", "bank"]) expect((await upload(founder, k)).status).toBe(200);
    expect((await upload(founder, "addr", PNG, "image/png", "lease.png")).status).toBe(200);
    expect((await request(app).post("/api/v1/join/complete").set("Authorization", founder).send({ agree: false })).status).toBe(400);
    const done = await request(app).post("/api/v1/join/complete").set("Authorization", founder).send({ agree: true });
    expect(done.body.message).toBe("Welcome! A ProofPocket checker is reviewing your documents.");
    const docs = await request(app).get("/api/v1/founder/documents").set("Authorization", founder);
    expect(docs.body.documents.filter((d: { state: string }) => d.state === "pending").map((d: { docType: string }) => d.docType).sort()).toEqual(["addr", "bank", "cipc", "id"]);
  });

  it("a pending document can't be replaced once joined", async () => {
    expect((await upload(founder, "cipc")).body.error.code).toBe("document_locked");
  });

  it("goes to the admin queue (no incubator), not to advisers", async () => {
    admin = await staff(ADMIN);
    const q = await request(app).get("/api/v1/admin/checks").set("Authorization", admin);
    expect(q.body.queue.filter((d: { companyName: string }) => d.companyName.startsWith("Lindi")).length).toBe(4);
    const adv = await request(app).get("/api/v1/adviser/checks").set("Authorization", await staff(ADVISER_N1));
    expect(adv.body.queue.some((d: { companyName: string }) => d.companyName.startsWith("Lindi"))).toBe(false);
  });

  it("send back needs a reason, messages the founder and lets them upload again", async () => {
    const q = (await request(app).get("/api/v1/admin/checks").set("Authorization", admin)).body.queue as { id: string; docType: string; companyName: string }[];
    const bank = q.find((d) => d.companyName.startsWith("Lindi") && d.docType === "bank")!;
    expect((await request(app).post(`/api/v1/admin/checks/${bank.id}/reject`).set("Authorization", admin).send({ reason: "" })).status).toBe(400);
    const r = await request(app).post(`/api/v1/admin/checks/${bank.id}/reject`).set("Authorization", admin).send({ reason: "The letter is older than 3 months" });
    expect(r.body.message).toBe("Sent back to the founder");
    expect(mailer.sent.at(-1)!.subject).toBe("Please upload your Business bank account confirmation again");
    const docs = await request(app).get("/api/v1/founder/documents").set("Authorization", founder);
    expect(docs.body.documents.find((d: { docType: string }) => d.docType === "bank")).toMatchObject({ state: "missing", sentBackReason: "The letter is older than 3 months" });
    expect((await upload(founder, "bank")).status).toBe(200);
  });

  it("the fourth approval makes the company Verified and sends “You're verified”", async () => {
    const q = (await request(app).get("/api/v1/admin/checks").set("Authorization", admin)).body.queue as { id: string; companyName: string }[];
    const mine = q.filter((d) => d.companyName.startsWith("Lindi"));
    expect(mine).toHaveLength(4);
    const results = [];
    for (const d of mine) results.push((await request(app).post(`/api/v1/admin/checks/${d.id}/approve`).set("Authorization", admin).send({})).body);
    expect(results.map((r) => r.verifiedNow)).toEqual([false, false, false, true]);
    expect(results.at(-1).message).toBe("Lindi's Kitchen (Pty) Ltd is now Verified");
    expect(mailer.sent.at(-1)!.subject).toBe("You're verified on ProofPocket");
    expect((await request(app).get("/api/v1/me").set("Authorization", founder)).body.company.verified).toBe(true);
  });
});

describe("advisers check their own cohort only", () => {
  it("approves ReKasi's pending CSD only as its own incubator's adviser", async () => {
    const other = await staff(ADVISER_N1); // Ikhaya; ReKasi is with Township Futures Trust
    const own = await staff("s.pillay@proofpocket.example");
    const q = (await request(app).get("/api/v1/adviser/checks").set("Authorization", own)).body.queue as { id: string; companyName: string; docType: string }[];
    const csd = q.find((d) => d.companyName === "ReKasi Plastics" && d.docType === "csd")!;
    expect(csd).toBeDefined();
    const denied = await request(app).post(`/api/v1/adviser/checks/${csd.id}/approve`).set("Authorization", other).send({});
    expect(denied.status).toBe(404);
    const ok = await request(app).post(`/api/v1/adviser/checks/${csd.id}/approve`).set("Authorization", own).send({ expiresOn: "2027-10-31" });
    expect(ok.body).toMatchObject({ message: "Approved", verifiedNow: false });
  });

  it("founders can't use the checker routes", async () => {
    expect((await request(app).get("/api/v1/admin/checks").set("Authorization", signIn("zanele@proofpocket.example"))).status).toBe(403);
  });
});

describe("downloads", () => {
  it("signed links only for people who can see the file", async () => {
    const admin = await staff(ADMIN);
    const q = (await request(app).get("/api/v1/admin/checks").set("Authorization", admin)).body.queue;
    // Admin queue may be empty now; use an adviser file instead.
    const own = await staff("n.mokoena@proofpocket.example");
    const aq = (await request(app).get("/api/v1/adviser/checks").set("Authorization", own)).body.queue as { fileId: string }[];
    const fileId = aq[0]!.fileId;
    const r = await request(app).get(`/api/v1/files/${fileId}/download-url`).set("Authorization", own);
    expect(r.body.url).toMatch(/^\/api\/v1\/storage\//);
    expect((await request(app).get(`/api/v1/files/${fileId}/download-url`).set("Authorization", signIn("zanele@proofpocket.example"))).status).toBe(404);
    expect((await request(app).get(`/api/v1/files/${fileId}/download-url`).set("Authorization", await staff(FUNDER))).status).toBe(404);
    void q;
  });
});

const FUNDER = "lesedi@proofpocket.example";
