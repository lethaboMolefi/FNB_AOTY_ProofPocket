import { pino } from "pino";
import { afterAll } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createDb } from "../src/db/client";
import { memoryMailer } from "../src/lib/mailer";
import { localStore } from "../src/lib/storage";
import { devVerifier } from "../src/middleware/auth";

export function testApp() {
  const config = loadConfig();
  const { pool, db } = createDb(config.DATABASE_URL);
  const mailer = memoryMailer();
  const app = createApp({ config, db, log: pino({ level: process.env.TEST_LOG ?? "silent" }), mailer, verify: devVerifier(config.OTP_SECRET), store: localStore(config) });
  afterAll(() => pool.end());
  return { app, db, mailer, config };
}

let clock = 1_700_000_000;
/** A fresh dev sign-in token. Each call is a new sign-in (new auth_time). */
export const signIn = (email: string) => `Bearer dev:${email}:${clock++}`;

export const FOUNDER = "zanele@proofpocket.example";
export const FOUNDER_2 = "palesa@proofpocket.example";
export const ADVISER_N1 = "n.mokoena@proofpocket.example";
export const FUNDER_F1 = "lesedi@proofpocket.example";
export const ADMIN = "admin@proofpocket.example";

export { nextCode, resetTotpStore, staffToken } from "./totp-store";

/** A brand-new founder who has finished joining (a Starter), for tests that change a company's settings. */
export async function newFounder(app: import("express").Express, label: string, incubator?: string) {
  const request = (await import("supertest")).default;
  const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@proofpocket.example`;
  const up = await request(app).post("/api/v1/auth/local/sign-up").send({ email, password: "a long and lovely passphrase" });
  const token = `Bearer ${up.body.token}`;
  const opts = await request(app).get("/api/v1/join/options");
  const incubatorId = incubator ? opts.body.incubators.find((i: { name: string }) => i.name === incubator)?.id ?? null : null;
  const joined = await request(app).post("/api/v1/join").set("Authorization", token).send({
    founderName: "Test Founder", idNumber: "8001015009087", phone: "0821234567", businessName: `Test ${label} ${Math.random().toString(36).slice(2, 6)}`, businessType: "food", sector: "Catering",
    town: "Soweto", province: "Gauteng", area: "township", incubatorId, registered: false,
  });
  if (joined.status !== 200) throw new Error(`join failed: ${JSON.stringify(joined.body)}`);
  const pdf = Buffer.from(`%PDF-1.4\n% ${email}\ntrailer<<>>\n%%EOF\n`);
  for (const docType of ["id", "addr"]) {
    const s = await request(app).post("/api/v1/founder/uploads").set("Authorization", token).send({ purpose: "document", name: `${docType}.pdf`, contentType: "application/pdf", size: pdf.length });
    await request(app).put(s.body.upload.url).set("Content-Type", "application/pdf").send(pdf);
    await request(app).post(`/api/v1/founder/uploads/${s.body.fileId}/complete`).set("Authorization", token).send({});
    await request(app).post("/api/v1/founder/documents").set("Authorization", token).send({ docType, fileId: s.body.fileId });
  }
  const done = await request(app).post("/api/v1/join/complete").set("Authorization", token).send({ agree: true });
  if (done.status !== 200) throw new Error(`join/complete failed: ${JSON.stringify(done.body)}`);
  return { token, email };
}
