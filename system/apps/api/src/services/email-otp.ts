// Email OTP for local development sign-up (AUTH_MODE=local). Generates a 6-digit code,
// emails it via the mailer, and verifies it. In-memory store; codes expire after 10 minutes.
// Production uses Firebase's built-in email verification instead.
import { randomInt } from "node:crypto";
import type { Mailer } from "../lib/mailer";

interface Entry { code: string; expiresAt: number; attempts: number }

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const store = new Map<string, Entry>();

const normalize = (email: string) => email.toLowerCase().trim();

export function sendEmailOtp(mailer: Mailer, email: string) {
  const key = normalize(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  store.set(key, { code, expiresAt: Date.now() + TTL_MS, attempts: 0 });

  // Best-effort: in console mode the code appears in the API log.
  void mailer.send({
    to: email,
    subject: "Your ProofPocket sign-up code",
    text: `Your ProofPocket sign-up code is ${code}. It expires in 10 minutes.\n\nIf you didn't create a ProofPocket account, you can ignore this email.`,
  });

  return { ok: true };
}

export function verifyEmailOtp(email: string, code: string): { ok: true } | { ok: false; reason: "expired" | "wrong" | "too_many" } {
  const key = normalize(email);
  const entry = store.get(key);
  if (!entry) return { ok: false, reason: "wrong" };
  if (entry.expiresAt < Date.now()) { store.delete(key); return { ok: false, reason: "expired" }; }

  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) { store.delete(key); return { ok: false, reason: "too_many" }; }

  if (entry.code !== code) return { ok: false, reason: "wrong" };

  store.delete(key);
  return { ok: true };
}
