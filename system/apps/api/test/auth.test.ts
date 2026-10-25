import request from "supertest";
import { describe, expect, it } from "vitest";
import { FOUNDER_2, nextCode, signIn, staffToken, testApp } from "./helpers";

// Signs in only with a password in these tests (dev test tokens would link the account to another identity).
const FOUNDER = "thandi@proofpocket.example";
import { TEST_PASSWORD } from "./global-setup";

const { app, mailer } = testApp();
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
    expect(weak.body.error.message).toMatch(/at least 12|too common/);
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

describe("two-step sign-in for founders (Google Authenticator)", () => {
  it("a founder turns it on, later sign-ins need a code, and turning it off needs one too", async () => {
    const token = signIn(FOUNDER_2);
    const { secret } = (await request(app).post("/api/v1/auth/totp/setup").set("Authorization", token).send({})).body;
    const a = nextCode(secret, 0);
    expect((await request(app).post("/api/v1/auth/totp/activate").set("Authorization", token).send({ code: a.code })).status).toBe(200);
    expect(mailer.sent.at(-1)).toMatchObject({ to: FOUNDER_2, subject: "Two-step sign-in is on" });
    expect((await request(app).get("/api/v1/me").set("Authorization", token)).body).toMatchObject({ needsOtp: false, twoFactor: { enabled: true, required: false } });

    const next = signIn(FOUNDER_2);
    expect((await request(app).get("/api/v1/me").set("Authorization", next)).body.needsOtp).toBe(true);
    expect((await request(app).get("/api/v1/founder/home").set("Authorization", next)).body.error.code).toBe("otp_required");
    expect((await request(app).post("/api/v1/auth/totp/disable").set("Authorization", next).send({ code: "123456" })).body.error.code).toBe("otp_required");

    const b = nextCode(secret, a.step);
    await request(app).post("/api/v1/auth/totp/verify").set("Authorization", next).send({ code: b.code });
    expect((await request(app).post("/api/v1/auth/totp/disable").set("Authorization", next).send({ code: b.code })).body.error.code).toBe("code_used");
    // With the next code it turns off, and the founder is told by email. (Codes are single-use, so wait for the next 30-second step.)
    let c: ReturnType<typeof nextCode> | null = null;
    while (!c) { try { c = nextCode(secret, b.step); } catch { await new Promise((r) => setTimeout(r, 1000)); } }
    expect((await request(app).post("/api/v1/auth/totp/disable").set("Authorization", next).send({ code: c.code })).status).toBe(200);
    expect(mailer.sent.at(-1)).toMatchObject({ to: FOUNDER_2, subject: "Two-step sign-in was turned off" });
  }, 70_000);

  it("a founder without it can't be asked for it, and can start set-up any time", async () => {
    const r = await request(app).post("/api/v1/auth/totp/setup").set("Authorization", signIn("sipho@proofpocket.example")).send({});
    expect(r.body.secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it("staff can't turn it off; admin can reset a lost phone", async () => {
    const funder = await staffToken(app, "lesedi@proofpocket.example");
    expect((await request(app).post("/api/v1/auth/totp/disable").set("Authorization", funder).send({ code: "000000" })).status).toBe(403);
    const admin = await staffToken(app, "admin@proofpocket.example");
    const me = (await request(app).get("/api/v1/me").set("Authorization", signIn(FOUNDER_2))).body;
    const reset = await request(app).post(`/api/v1/admin/users/${me.id}/reset-authenticator`).set("Authorization", admin).send({});
    expect(reset.body.message).toBe("Authenticator reset for Palesa K.");
    expect(mailer.sent.at(-1)!.subject).toBe("Your ProofPocket authenticator was reset");
    expect((await request(app).get("/api/v1/me").set("Authorization", signIn(FOUNDER_2))).body).toMatchObject({ needsOtp: false, twoFactor: { enabled: false } });
    expect((await request(app).post(`/api/v1/admin/users/${me.id}/reset-authenticator`).set("Authorization", funder).send({})).status).toBe(403);
  });
});
