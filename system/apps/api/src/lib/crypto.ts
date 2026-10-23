// Application-level encryption for bank account numbers (AES-256-GCM), and keyed hashes for one-time PINs.
import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

export function encryptField(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptField(stored: string, keyB64: string): string {
  const [version, iv, tag, ct] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Last four digits only, for display: "••4821". */
export const last4 = (accountNumber: string) => accountNumber.replace(/\D/g, "").slice(-4);

export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** The challenge id is mixed in so the same code never hashes the same way twice. */
export const hashCode = (code: string, challengeId: string, secretB64: string) =>
  createHmac("sha256", Buffer.from(secretB64, "base64")).update(`${challengeId}:${code}`).digest("hex");

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** URL-safe random token, e.g. the unguessable part of a payment link. */
export const randomToken = (bytes = 9) => randomBytes(bytes).toString("base64url");
