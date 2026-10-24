import request from "supertest";
import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "../src/lib/crypto";
import { loadConfig } from "../src/config";
import { ADMIN, FOUNDER, FUNDER_F1, signIn, testApp } from "./helpers";

const { app, mailer, config } = testApp();
const pinFrom = (text: string) => /\b(\d{6})\b/.exec(text)![1]!;

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
    const bad = await request(app).post("/api/v1/auth/otp/request").set("Authorization", signIn(FOUNDER)).set("Content-Type", "application/json").send("{oops");
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

  it("funders must pass an email PIN on every sign-in", async () => {
    const token = signIn(FUNDER_F1);
    const me = await request(app).get("/api/v1/me").set("Authorization", token);
    expect(me.body).toMatchObject({ role: "funder", needsOtp: true, org: { name: "Lesedi Youth Fund", type: "funder", setupDone: true } });

    const sent = await request(app).post("/api/v1/auth/otp/request").set("Authorization", token).send({ purpose: "sign_in" });
    expect(sent.body).toEqual({ sentTo: "le••••@proofpocket.example", expiresInMinutes: 10 });
    const mail = mailer.sent.at(-1)!;
    expect(mail.to).toBe(FUNDER_F1);
    expect(mail.text).toContain("will never phone you");
    const pin = pinFrom(mail.text);

    const wrong = await request(app).post("/api/v1/auth/otp/verify").set("Authorization", token).send({ purpose: "sign_in", code: pin === "000000" ? "111111" : "000000" });
    expect(wrong.body.error.code).toBe("otp_wrong");
    const ok = await request(app).post("/api/v1/auth/otp/verify").set("Authorization", token).send({ purpose: "sign_in", code: pin });
    expect(ok.status).toBe(200);
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body.needsOtp).toBe(false);

    // The same PIN can't be used twice.
    const again = await request(app).post("/api/v1/auth/otp/verify").set("Authorization", token).send({ purpose: "sign_in", code: pin });
    expect(again.body.error.code).toBe("otp_expired");
    // A new sign-in needs a new PIN.
    expect((await request(app).get("/api/v1/me").set("Authorization", signIn(FUNDER_F1))).body.needsOtp).toBe(true);
  });

  it("locks a PIN after five wrong tries", async () => {
    const token = signIn(ADMIN);
    await request(app).post("/api/v1/auth/otp/request").set("Authorization", token).send({ purpose: "sign_in" });
    const pin = pinFrom(mailer.sent.at(-1)!.text);
    const wrong = pin === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await request(app).post("/api/v1/auth/otp/verify").set("Authorization", token).send({ purpose: "sign_in", code: wrong });
    const r = await request(app).post("/api/v1/auth/otp/verify").set("Authorization", token).send({ purpose: "sign_in", code: pin });
    expect(r.body.error.code).toBe("otp_locked");
  });

  it("validates input with a readable message", async () => {
    const r = await request(app).post("/api/v1/auth/otp/verify").set("Authorization", signIn(ADMIN)).send({ purpose: "sign_in", code: "12" });
    expect(r.status).toBe(400);
    expect(r.body.error).toEqual({ code: "validation_failed", message: "code: Enter the 6-digit PIN from your email" });
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
