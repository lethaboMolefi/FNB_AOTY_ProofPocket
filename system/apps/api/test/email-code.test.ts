import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { signIn, testApp } from "./helpers";

const { app, mailer } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());

let clock = 1_800_000_000;
/** A sign-in whose email isn't confirmed yet (dev tokens only). */
const unconfirmed = (email: string) => `Bearer devu:${email}:${clock++}`;
const newEmail = (label: string) => `code.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@proofpocket.example`;
const codeFor = (email: string) => [...mailer.sent].reverse().find((m) => m.to === email && m.subject === "Your ProofPocket confirmation code")?.text.match(/\b(\d{6})\b/)?.[1];
const send = (tok: string, resend = false) => request(app).post("/api/v1/auth/email-code/send").set("Authorization", tok).send({ resend });
const verify = (tok: string, code: string) => request(app).post("/api/v1/auth/email-code/verify").set("Authorization", tok).send({ code });

describe("email confirmation code", () => {
  it("emails a 6-digit code from ProofPocket, stores only a hash, and confirms the email once", async () => {
    const email = newEmail("ok");
    const tok = unconfirmed(email);
    const r = await send(tok);
    expect(r.body).toMatchObject({ sent: true, confirmed: false, message: `We emailed a 6-digit code to ${email}.` });
    const code = codeFor(email)!;
    expect(code).toMatch(/^\d{6}$/);
    const row = (await owner.query("select code_hash from email_codes where email = $1", [email])).rows[0];
    expect(row.code_hash).not.toContain(code);
    expect((await verify(tok, code)).body).toEqual({ message: "Email confirmed" });
    // Used up: the row is gone.
    expect((await owner.query("select count(*)::int as n from email_codes where email = $1", [email])).rows[0].n).toBe(0);
    expect((await verify(tok, code)).body.error.code).toBe("code_wrong");
  });

  it("doesn't email again while a code still works, and resends only after 30 seconds", async () => {
    const email = newEmail("resend");
    const tok = unconfirmed(email);
    await send(tok);
    const sent = mailer.sent.filter((m) => m.to === email).length;
    expect((await send(tok)).body.sent).toBe(false);
    expect((await send(tok, true)).body.error.code).toBe("too_soon");
    await owner.query("update email_codes set sent_at = now() - interval '31 seconds' where email = $1", [email]);
    expect((await send(tok, true)).body.sent).toBe(true);
    expect(mailer.sent.filter((m) => m.to === email).length).toBe(sent + 1);
  });

  it("allows 5 wrong tries, then a new code is needed; expired codes are refused", async () => {
    const email = newEmail("tries");
    const tok = unconfirmed(email);
    await send(tok);
    const right = codeFor(email)!;
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verify(tok, wrong)).body.error.code).toBe("code_wrong");
    expect((await verify(tok, right)).body.error.code).toBe("code_locked");
    await owner.query("update email_codes set sent_at = now() - interval '1 minute' where email = $1", [email]);
    await send(tok, true);
    await owner.query("update email_codes set expires_at = now() - interval '1 second' where email = $1", [email]);
    expect((await verify(tok, codeFor(email)!)).body.error.code).toBe("code_expired");
  });

  it("needs a sign-in; already-confirmed sign-ins (Google, local) skip it; the code must be 6 digits", async () => {
    expect((await request(app).post("/api/v1/auth/email-code/send").send({})).status).toBe(401);
    expect((await send(signIn(newEmail("google")))).body).toMatchObject({ confirmed: true, sent: false });
    expect((await verify(unconfirmed(newEmail("bad")), "12ab")).status).toBe(400);
  });

  it("no account or business is created before the email is confirmed", async () => {
    const email = newEmail("join");
    const r = await request(app).post("/api/v1/join").set("Authorization", unconfirmed(email)).send({});
    expect(r.body.error.code).toBe("verify_email");
    expect((await owner.query("select count(*)::int as n from users where lower(email) = $1", [email])).rows[0].n).toBe(0);
  });

  it("joining stays blocked until the email is confirmed", async () => {
    const tok = unconfirmed(newEmail("apply"));
    const r = await request(app).post("/api/v1/join/applications").set("Authorization", tok).send({ kind: "funder", details: {} });
    expect(r.body.error).toEqual({ code: "verify_email", message: "Confirm your email address first: enter the 6-digit code we emailed you." });
  });
});
