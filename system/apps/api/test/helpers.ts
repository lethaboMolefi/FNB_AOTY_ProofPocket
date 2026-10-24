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
