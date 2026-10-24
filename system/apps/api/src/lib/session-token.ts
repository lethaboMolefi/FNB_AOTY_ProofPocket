// Signed sign-in tokens for AUTH_MODE=local (development). Same claims the API reads from a Firebase ID token.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionClaims { sub: string; email: string; at: number; exp: number }

const key = (secretB64: string) => createHmac("sha256", Buffer.from(secretB64, "base64")).update("proofpocket-local-session").digest();
const sign = (body: string, secretB64: string) => createHmac("sha256", key(secretB64)).update(body).digest("base64url");

export function issueSessionToken(c: Omit<SessionClaims, "exp">, secretB64: string, ttlSeconds = 12 * 3600): string {
  const body = Buffer.from(JSON.stringify({ ...c, exp: c.at + ttlSeconds })).toString("base64url");
  return `local.${body}.${sign(body, secretB64)}`;
}

export function readSessionToken(token: string, secretB64: string, now = Math.floor(Date.now() / 1000)): SessionClaims {
  const [prefix, body, sig] = token.split(".");
  if (prefix !== "local" || !body || !sig) throw new Error("not a local token");
  const expected = Buffer.from(sign(body, secretB64)), got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) throw new Error("bad signature");
  const c = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionClaims;
  if (c.exp < now) throw new Error("expired");
  return c;
}
