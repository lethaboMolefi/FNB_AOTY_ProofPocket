import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, newFounder, staffToken, testApp } from "./helpers";

const { app } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());
const PW = "a lovely long passphrase";

describe("choose the password after joining", () => {
  it("a new email sign-up joins first, then must choose its password before anything else", async () => {
    const f = await newFounder(app, "later", undefined, { passwordLater: true });
    // Joined (Join ProofPocket clicked): only /me and choosing the password work now.
    const me = await request(app).get("/api/v1/me").set("Authorization", f.token);
    expect(me.body).toMatchObject({ needsPassword: true, company: { joined: true } });
    expect((await request(app).get("/api/v1/founder/home").set("Authorization", f.token)).body.error.code).toBe("password_required");
    expect((await request(app).post("/api/v1/auth/password/first").set("Authorization", f.token).send({ password: "short" })).body.error.code).toBe("weak_password");
    expect((await request(app).post("/api/v1/auth/password/first").set("Authorization", f.token).send({ password: PW })).body.message).toMatch(/Password saved/);
    expect((await request(app).get("/api/v1/founder/home").set("Authorization", f.token)).status).toBe(200);
    // Once only; and the new password signs in.
    expect((await request(app).post("/api/v1/auth/password/first").set("Authorization", f.token).send({ password: PW })).body.error.code).toBe("password_already_set");
    expect((await request(app).post("/api/v1/auth/local/sign-in").send({ email: f.email, password: PW })).body.token).toBeTruthy();
  });

  it("an existing sign-in can't be marked to choose a new password (no takeover with a stolen session)", async () => {
    const f = await newFounder(app, "old");
    await owner.query("update local_credentials set created_at = now() - interval '1 hour' where lower(email) = $1", [f.email]);
    expect((await request(app).post("/api/v1/auth/password/later").set("Authorization", f.token)).body.error.code).toBe("forbidden");
    expect((await request(app).post("/api/v1/auth/password/first").set("Authorization", f.token).send({ password: PW })).body.error.code).toBe("password_already_set");
    expect((await request(app).post("/api/v1/auth/password/later").set("Authorization", await staffToken(app, ADMIN))).status).toBe(403);
  });
});
