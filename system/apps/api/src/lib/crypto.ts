// Application-level encryption (AES-256-GCM) for bank account numbers and authenticator secrets.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
/** GCM authentication tags are always 16 bytes; a shorter tag must never be accepted. */
const TAG_BYTES = 16;

export function encryptField(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptField(stored: string, keyB64: string): string {
  const [version, iv, tag, ct] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !ct) throw new Error("Unrecognised encrypted value");
  const authTag = Buffer.from(tag, "base64");
  if (authTag.length !== TAG_BYTES) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), Buffer.from(iv, "base64"), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Last four digits only, for display: "••4821". */
export const last4 = (accountNumber: string) => accountNumber.replace(/\D/g, "").slice(-4);

/** URL-safe random token, e.g. the unguessable part of a payment link. */
export const randomToken = (bytes = 9) => randomBytes(bytes).toString("base64url");
