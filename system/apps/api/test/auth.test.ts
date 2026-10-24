import request from "supertest";
import { describe, expect, it } from "vitest";
import { FOUNDER_2, signIn, testApp } from "./helpers";

// Signs in only with a password in these tests (dev test tokens would link the account to another identity).
const FOUNDER = "thandi@proofpocket.example";
import { TEST_PASSWORD } from "./global-setup";

const { app, mailer } = testApp();
const pinFrom = (text: string) => /\b(\d{6})\b/.exec(text)![1]!;
const bearer = (t: string) => `Bearer ${t}`;

describe("password sign-in (local development mode)", () => {
  it("signs in with the right password and gets a token the API accepts", async () => {
    const r = await request(app).post("/api/v1/auth/local/sign-in").send({ email: FOUNDER, password: TEST_PASSWORD });
    expect(r.status).toBe(200);
    const me = await request(app).get("/api/v1/me").set("Authorization", bearer(r.body.token));
    expect(me.body).toMatchObject({ email: FOUNDER, role: "founder", twoFactor: { enabled: false, required: false } });
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const a = await request(app).post("/api/v1/auth/local/sign-in").send({ email: FOUNDER, password: "not-the-password" });
    const b = await request(app).post("/api/v1/auth/local/sign-in").send({ email: "nobody@proofpocket.example", password: "not-the-password" });
    expect(a.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it("locks the account after five wrong passwords, even for the right one", async () => {
    const email = "kabelo@proofpocket.example";
    for (let i = 0; i < 4; i++) expect((await request(app).post("/api/v1/auth/local/sign-in").send({ email, password: "wrong-" + i })).status).toBe(401);
    expect((await request(app).post("/api/v1/auth/local/sign-in").send({ email, password: "wrong-5" })).body.error.code).toBe("account_locked");
    expect((await request(app).post("/api/v1/auth/local/sign-in").send({ email, password: TEST_PASSWORD })).body.error.code).toBe("account_locked");
  });

  it("rejects weak passwords at sign-up", async () => {
    const weak = await request(app).post("/api/v1/auth/local/sign-up").send({ email: "new.founder@proofpocket.example", password: "password123" });
    expect(weak.body.error.message).toMatch(/at least 10|too common/);
    const named = await request(app).post("/api/v1/auth/local/sign-up").send({ email: "nomsa@proofpocket.example", password: "nomsa-is-great-2026" });
    expect(named.body.error.message).toMatch(/email name/);
    const ok = await request(app).post("/api/v1/auth/local/sign-up").send({ email: "new.founder@proofpocket.example", password: "a sentence about my spaza" });
    expect(ok.status).toBe(200);
    const again = await request(app).post("/api/v1/auth/local/sign-up").send({ email: "New.Founder@proofpocket.example", password: "another long sentence" });
    expect(again.body.error.code).toBe("email_taken");
  });

  it("rejects a tampered token", async () => {
    const { token } = (await request(app).post("/api/v1/auth/local/sign-in").send({ email: FOUNDER, password: TEST_PASSWORD })).body as { token: string };
    const [p, body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body!, "base64url").toString());
    forged.email = "admin@proofpocket.example";
    const bad = `${p}.${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect((await request(app).get("/api/v1/me").set("Authorization", bearer(bad))).body.error.code).toBe("invalid_token");
  });
});

describe("two-step sign-in for founders", () => {
  it("a founder turns it on with a PIN, and later sign-ins need a PIN", async () => {
    const token = signIn(FOUNDER_2);
    await request(app).post("/api/v1/auth/otp/request").set("Authorization", token).send({ purpose: "two_factor" });
    const pin = pinFrom(mailer.sent.at(-1)!.text);
    const on = await request(app).post("/api/v1/auth/two-factor").set("Authorization", token).send({ enabled: true, code: pin });
    expect(on.body).toEqual({ ok: true, enabled: true });
    expect(mailer.sent.at(-1)!.subject).toBe("Two-step sign-in is on");
    // This sign-in already passed the PIN.
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body).toMatchObject({ needsOtp: false, twoFactor: { enabled: true } });
    // A new sign-in must pass a PIN before anything else.
    const next = signIn(FOUNDER_2);
    expect((await request(app).get("/api/v1/me").set("Authorization", next)).body.needsOtp).toBe(true);
    const blocked = await request(app).post("/api/v1/auth/two-factor").set("Authorization", next).send({ enabled: false, code: "123456" });
    expect(blocked.body.error.code).toBe("otp_required");
  });

  it("can't be changed without a valid PIN", async () => {
    const token = signIn("sipho@proofpocket.example");
    const r = await request(app).post("/api/v1/auth/two-factor").set("Authorization", token).send({ enabled: true, code: "000000" });
    expect(r.body.error.code).toBe("otp_expired");
  });

  it("staff can't turn it off", async () => {
    const r = await request(app).post("/api/v1/auth/two-factor").set("Authorization", signIn("lesedi@proofpocket.example")).send({ enabled: false, code: "000000" });
    expect(r.status).toBe(403);
  });
});
