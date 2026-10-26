import request from "supertest";
import { describe, expect, it } from "vitest";
import { testApp } from "./helpers";

const { app, mailer } = testApp();
const codeFor = (email: string) => {
  const m = [...mailer.sent].reverse().find((x) => x.to === email && x.subject === "Your ProofPocket sign-up code");
  return m?.text.match(/\b(\d{6})\b/)?.[1];
};
const send = (email: string) => request(app).post("/api/v1/auth/email-otp/send").send({ email });
const check = (email: string, code: string) => request(app).post("/api/v1/auth/email-otp/verify").send({ email, code });

describe("sign-up email code (local)", () => {
  it("emails a 6-digit code that works once", async () => {
    const email = `otp.${Date.now()}@proofpocket.example`;
    expect((await send(email)).body).toEqual({ ok: true });
    const code = codeFor(email)!;
    expect(code).toMatch(/^\d{6}$/);
    expect((await check(email, code)).body).toEqual({ ok: true });
    expect((await check(email, code)).body.error.code).toBe("otp_wrong");
  });

  it("a wrong code is refused, and after 5 tries a new code is needed", async () => {
    const email = `otp.tries.${Date.now()}@proofpocket.example`;
    await send(email);
    const right = codeFor(email)!;
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await check(email, wrong)).body.error.message).toBe("That code isn't right. Check it and try again.");
    expect((await check(email, right)).body.error.message).toBe("Too many wrong codes. Request a new one.");
  });

  it("refuses a code for an email that never asked for one, and bad input", async () => {
    expect((await check("nobody@proofpocket.example", "123456")).status).toBe(400);
    expect((await send("not-an-email")).status).toBe(400);
  });
});
