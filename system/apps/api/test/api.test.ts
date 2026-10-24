import request from "supertest";
import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "../src/lib/crypto";
import { loadConfig } from "../src/config";
import { ADMIN, FOUNDER, nextCode, signIn, testApp } from "./helpers";

const { app, mailer, config } = testApp();

describe("http basics", () => {
  it("health and OpenAPI", async () => {
    expect((await request(app).get("/api/v1/health")).body).toEqual({ ok: true });
    const doc = await request(app).get("/api/v1/openapi.json");
    expect(doc.body.paths["/me"]).toBeDefined();
  });

  it("errors use { error: { code, message } }", async () => {
    const r = await request(app).get("/api/v1/nope");
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: "not_found", message: "Not found." } });
    const bad = await request(app).post("/api/v1/auth/totp/verify").set("Authorization", signIn(FOUNDER)).set("Content-Type", "application/json").send("{oops");
    expect(bad.body.error.code).toBe("bad_json");
  });

  it("sets security headers and hides the framework", async () => {
    const r = await request(app).get("/api/v1/health");
    expect(r.headers["x-powered-by"]).toBeUndefined();
    expect(r.headers["strict-transport-security"]).toBeDefined();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("sign-in", () => {
  it("needs a token", async () => {
    const r = await request(app).get("/api/v1/me");
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("unauthenticated");
  });

  it("rejects a bad token", async () => {
    const r = await request(app).get("/api/v1/me").set("Authorization", "Bearer nonsense");
    expect(r.body.error.code).toBe("invalid_token");
  });

  it("a signed-in stranger has no account yet", async () => {
    const r = await request(app).get("/api/v1/me").set("Authorization", signIn("new.person@proofpocket.example"));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("no_account");
  });

  it("founders sign in without a PIN; the role comes from the database", async () => {
    const r = await request(app).get("/api/v1/me").set("Authorization", signIn(FOUNDER));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ email: FOUNDER, role: "founder", needsOtp: false, org: null, twoFactor: { enabled: false, required: false } });
    expect(r.body.company).toMatchObject({ name: "Nala Nails & Lashes", town: "Soweto", businessType: "beauty", verified: false, joined: true });
  });

  it("funders must set up Google Authenticator, then enter a code on every sign-in", async () => {
    const email = "umnotho@proofpocket.example";
    const token = signIn(email);
    const me = await request(app).get("/api/v1/me").set("Authorization", token);
    expect(me.body).toMatchObject({ role: "funder", needsOtp: true, twoFactor: { enabled: false, required: true } });
    // Nothing else works until then.
    expect((await request(app).get("/api/v1/adviser/checks").set("Authorization", token)).status).toBe(403);

    const setup = await request(app).post("/api/v1/auth/totp/setup").set("Authorization", token).send({});
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/ProofPocket%3Aumnotho%40proofpocket\.example\?secret=[A-Z2-7]+&issuer=ProofPocket/);
    const secret = setup.body.secret as string;
    expect((await request(app).post("/api/v1/auth/totp/activate").set("Authorization", token).send({ code: "000000" })).body.error.code).toBe("code_wrong");
    const first = nextCode(secret, 0);
    expect((await request(app).post("/api/v1/auth/totp/activate").set("Authorization", token).send({ code: first.code })).status).toBe(200);
    expect(mailer.sent.at(-1)!.subject).toBe("Two-step sign-in is on");
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body).toMatchObject({ needsOtp: false, twoFactor: { enabled: true, required: true } });

    // A new sign-in needs a code again, and the same code can't be used twice.
    const next = signIn(email);
    expect((await request(app).get("/api/v1/me").set("Authorization", next)).body.needsOtp).toBe(true);
    expect((await request(app).post("/api/v1/auth/totp/verify").set("Authorization", next).send({ code: first.code })).body.error.code).toBe("code_used");
    const second = nextCode(secret, first.step);
    expect((await request(app).post("/api/v1/auth/totp/verify").set("Authorization", next).send({ code: second.code })).status).toBe(200);
    expect((await request(app).get("/api/v1/me").set("Authorization", next)).body.needsOtp).toBe(false);
    // Can't start set-up again while it's on.
    expect((await request(app).post("/api/v1/auth/totp/setup").set("Authorization", next).send({})).body.error.code).toBe("authenticator_on");
  });

  it("locks after five wrong codes", async () => {
    const email = "kopano@proofpocket.example";
    const token = signIn(email);
    const { secret } = (await request(app).post("/api/v1/auth/totp/setup").set("Authorization", token).send({})).body;
    const ok = nextCode(secret, 0);
    await request(app).post("/api/v1/auth/totp/activate").set("Authorization", token).send({ code: ok.code });
    const t2 = signIn(email);
    const wrong = ok.code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 4; i++) expect((await request(app).post("/api/v1/auth/totp/verify").set("Authorization", t2).send({ code: wrong })).body.error.code).toBe("code_wrong");
    expect((await request(app).post("/api/v1/auth/totp/verify").set("Authorization", t2).send({ code: wrong })).body.error.code).toBe("code_locked");
    const right = nextCode(secret, ok.step);
    expect((await request(app).post("/api/v1/auth/totp/verify").set("Authorization", t2).send({ code: right.code })).body.error.code).toBe("code_locked");
  });

  it("validates codes with a readable message", async () => {
    const r = await request(app).post("/api/v1/auth/totp/verify").set("Authorization", signIn(ADMIN)).send({ code: "12" });
    expect(r.status).toBe(400);
    expect(r.body.error).toEqual({ code: "validation_failed", message: "code: Enter the 6-digit code from Google Authenticator" });
  });
});

describe("config and crypto", () => {
  it("refuses dev sign-in and console mail in production", () => {
    expect(() => loadConfig({ ...process.env, NODE_ENV: "production", AUTH_MODE: "dev" })).toThrow(/AUTH_MODE/);
    expect(() => loadConfig({ ...process.env, NODE_ENV: "production", AUTH_MODE: "local" })).toThrow(/AUTH_MODE/);
    expect(() => loadConfig({ ...process.env, NODE_ENV: "development", AUTH_MODE: "dev" })).toThrow(/tests only/);
    expect(() => loadConfig({ ...process.env, NODE_ENV: "production", AUTH_MODE: "firebase", FIREBASE_PROJECT_ID: "x", MAIL_MODE: "console" })).toThrow(/MAIL_MODE/);
  });
  it("encrypts account numbers so the stored value doesn't contain them", () => {
    const enc = encryptField("6281 004 517", config.ACCOUNT_NUMBER_KEY);
    expect(enc).not.toContain("6281");
    expect(decryptField(enc, config.ACCOUNT_NUMBER_KEY)).toBe("6281 004 517");
  });
});
