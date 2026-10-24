// ---------------------------------------------------------------- Google Authenticator for staff accounts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { codeFor, stepAt } from "../src/lib/totp";
import type { Express } from "express";

let clock = 1_800_000_000;
const signIn = (email: string) => `Bearer dev:${email}:${clock++}`;

/** Shared across test files: a staff user's authenticator secret and a token that already passed two-step sign-in. */
const STORE = join(tmpdir(), "proofpocket-test-totp.json");
type Enrolled = Record<string, { secret: string; token: string; lastStep: number }>;
const load = (): Enrolled => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : {});
const save = (e: Enrolled) => writeFileSync(STORE, JSON.stringify(e));
/** The global test setup starts each run with a fresh database, so forget old secrets. */
export const resetTotpStore = () => save({});

/** A code for the next unused time step (codes can't be reused; one step ahead is accepted). */
export function nextCode(secret: string, lastStep: number) {
  const now = stepAt(Date.now() / 1000);
  const step = Math.max(now, lastStep + 1);
  if (step > now + 1) throw new Error("no unused code in this 30-second window");
  return { code: codeFor(secret, step), step };
}

/** Signs a staff member in with Google Authenticator, setting it up the first time. */
export async function staffToken(app: Express, email: string): Promise<string> {
  const all = load();
  if (all[email]) return all[email].token;
  const token = signIn(email);
  const setup = await request(app).post("/api/v1/auth/totp/setup").set("Authorization", token).send({});
  if (setup.status !== 200) throw new Error(`setup failed: ${JSON.stringify(setup.body)}`);
  const { code, step } = nextCode(setup.body.secret, 0);
  const act = await request(app).post("/api/v1/auth/totp/activate").set("Authorization", token).send({ code });
  if (act.status !== 200) throw new Error(`activate failed: ${JSON.stringify(act.body)}`);
  all[email] = { secret: setup.body.secret, token, lastStep: step };
  save(all);
  return token;
}
