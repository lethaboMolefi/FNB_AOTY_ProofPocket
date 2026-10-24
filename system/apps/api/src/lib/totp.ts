// Time-based one-time codes (RFC 6238), the codes Google Authenticator shows: SHA-1, 6 digits, 30 seconds.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PERIOD = 30;
export const DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("bad base32");
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 (what Google Authenticator stores). */
export const newSecret = () => base32Encode(randomBytes(20));

export const stepAt = (unixSeconds: number) => Math.floor(unixSeconds / PERIOD);

/** The code for a time step (HOTP, RFC 4226). `digits` is 6 for Google Authenticator. */
export function codeFor(secretB32: string, step: number, digits = DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secretB32)).update(counter).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

/**
 * The time step a code belongs to, allowing one step of clock drift either way, or null.
 * The caller must refuse any step at or before the last one used (no replays).
 */
export function matchStep(secretB32: string, code: string, nowSeconds = Math.floor(Date.now() / 1000)): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepAt(nowSeconds);
  for (const s of [now - 1, now, now + 1]) {
    const a = Buffer.from(codeFor(secretB32, s)), b = Buffer.from(code);
    if (timingSafeEqual(a, b)) return s;
  }
  return null;
}

/** The link an authenticator app reads from the QR code. */
export const otpauthUri = (secretB32: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`ProofPocket:${account}`)}?secret=${secretB32}&issuer=ProofPocket&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
