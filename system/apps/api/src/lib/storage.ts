// File storage. Clients upload straight to storage with a short-lived signed PUT URL (fixed type and size);
// downloads go through 5-minute signed read URLs after the API has checked access.
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { Storage as Gcs } from "@google-cloud/storage";
import type { Config } from "../config";

export const SIGNED_URL_SECONDS = 300;

export interface UploadTarget { url: string; method: "PUT"; headers: Record<string, string> }

export interface FileStore {
  uploadTarget(path: string, contentType: string, size: number): Promise<UploadTarget>;
  read(path: string): Promise<Buffer>;
  remove(path: string): Promise<void>;
  downloadUrl(path: string, filename: string, contentType: string): Promise<string>;
}

// ---------------------------------------------------------------- Cloud Storage (production)
export function gcsStore(bucketName: string): FileStore {
  const bucket = new Gcs().bucket(bucketName);
  const expires = () => Date.now() + SIGNED_URL_SECONDS * 1000;
  return {
    async uploadTarget(path, contentType, size) {
      const headers = { "Content-Type": contentType, "x-goog-content-length-range": `${size},${size}` };
      const [url] = await bucket.file(path).getSignedUrl({ version: "v4", action: "write", expires: expires(), contentType, extensionHeaders: { "x-goog-content-length-range": `${size},${size}` } });
      return { url, method: "PUT", headers };
    },
    async read(path) { const [buf] = await bucket.file(path).download(); return buf; },
    async remove(path) { await bucket.file(path).delete({ ignoreNotFound: true }); },
    async downloadUrl(path, filename, contentType) {
      const [url] = await bucket.file(path).getSignedUrl({
        version: "v4", action: "read", expires: expires(),
        responseDisposition: `attachment; filename="${filename.replace(/[^\w.-]+/g, "_")}"`, responseType: contentType,
      });
      return url;
    },
  };
}

// ---------------------------------------------------------------- local disk (development and tests)
interface LocalGrant { p: string; op: "put" | "get"; t: string; s?: number; n?: string; exp: number }

export interface LocalStore extends FileStore {
  /** Checks a signed storage URL token; throws if forged or expired. */
  grant(token: string): LocalGrant;
  write(path: string, data: Buffer): Promise<void>;
}

export function localStore(config: Config): LocalStore {
  const root = normalize(config.STORAGE_DIR);
  // The string is a key-derivation label, not a secret; the secret is OTP_SECRET from the environment.
  // nosemgrep: node_secret
  const key = createHmac("sha256", Buffer.from(config.OTP_SECRET, "base64")).update("proofpocket-local-storage").digest();
  const sign = (body: string) => createHmac("sha256", key).update(body).digest("base64url");
  const token = (g: Omit<LocalGrant, "exp">) => {
    const body = Buffer.from(JSON.stringify({ ...g, exp: Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS })).toString("base64url");
    return `${body}.${sign(body)}`;
  };
  const resolve = (path: string) => {
    const full = normalize(join(root, path));
    if (!full.startsWith(root)) throw new Error("path outside storage");
    return full;
  };
  return {
    grant(t) {
      const [body, sig] = t.split(".");
      if (!body || !sig) throw new Error("bad token");
      const a = Buffer.from(sign(body)), b = Buffer.from(sig);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("bad signature");
      const g = JSON.parse(Buffer.from(body, "base64url").toString()) as LocalGrant;
      if (g.exp < Math.floor(Date.now() / 1000)) throw new Error("expired");
      return g;
    },
    async write(path, data) { const f = resolve(path); await mkdir(dirname(f), { recursive: true }); await writeFile(f, data); },
    async uploadTarget(path, contentType, size) {
      return { url: `/api/v1/storage/${token({ p: path, op: "put", t: contentType, s: size })}`, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async read(path) { return readFile(resolve(path)); },
    async remove(path) { await rm(resolve(path), { force: true }); },
    async downloadUrl(path, filename, contentType) {
      return `/api/v1/storage/${token({ p: path, op: "get", t: contentType, n: filename })}`;
    },
  };
}

export function createStore(config: Config): FileStore {
  return config.STORAGE_MODE === "gcs" ? gcsStore(config.GCS_BUCKET!) : localStore(config);
}
