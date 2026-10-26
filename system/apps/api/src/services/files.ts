// Upload flow: start (signed PUT URL) → client uploads → complete (API checks type by signature and computes SHA-256).
import { createHash, randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES } from "@proofpocket/shared";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { files } from "../db/schema/index";
import { AppError, notFound } from "../lib/errors";
import { detectType, type DetectedType } from "../lib/file-signature";
import type { FileStore } from "../lib/storage";

type Purpose = "document" | "receipt" | "proof" | "statement";

const ALLOWED: Record<Purpose, DetectedType[]> = {
  document: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  receipt: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  proof: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  statement: ["application/pdf", "text/csv"],
};

const safeName = (n: string) => n.replace(/[\\/\0]/g, "_").slice(0, 160);

export async function startUpload(
  tx: Tx, store: FileStore,
  u: { companyId: string; purpose: Purpose; name: string; contentType: string; size: number; userId: string | null },
) {
  if (u.size > MAX_UPLOAD_BYTES) throw new AppError(400, "too_large", "Files must be 5 MB or smaller");
  const id = randomUUID();
  const bucketPath = `${u.companyId}/${u.purpose}/${id}`;
  await tx.insert(files).values({ id, companyId: u.companyId, purpose: u.purpose, bucketPath, mime: u.contentType, sizeBytes: u.size, originalName: safeName(u.name), uploadedBy: u.userId });
  return { fileId: id, upload: await store.uploadTarget(bucketPath, u.contentType, u.size) };
}

/** Reads the stored bytes, checks the real file type and records the SHA-256 fingerprint. */
export async function completeUpload(tx: Tx, store: FileStore, fileId: string) {
  const [f] = await tx.select().from(files).where(eq(files.id, fileId));
  if (!f) throw notFound("That upload");
  if (f.sha256) return { fileId: f.id, sha256: f.sha256, name: f.originalName, mime: f.mime };
  let data: Buffer;
  try { data = await store.read(f.bucketPath); } catch { throw new AppError(400, "not_uploaded", "The file didn't finish uploading. Try again."); }
  const type = detectType(data);
  const allowed = ALLOWED[f.purpose as Purpose];
  if (data.length !== f.sizeBytes || data.length > MAX_UPLOAD_BYTES || !type || !allowed.includes(type)) {
    await store.remove(f.bucketPath);
    await tx.delete(files).where(eq(files.id, f.id));
    throw new AppError(400, "file_type", f.purpose === "statement"
      ? "That isn't a bank statement we can read. Download the PDF statement from your banking app and try again."
      : "That file isn't a PDF or photo we can open. Upload a PDF, JPG, PNG or WebP of 5 MB or less.");
  }
  const sha256 = createHash("sha256").update(data).digest("hex");
  await tx.update(files).set({ sha256, mime: type, registeredAt: new Date() }).where(eq(files.id, f.id));
  return { fileId: f.id, sha256, name: f.originalName, mime: type };
}

/** A registered file of this company and purpose, or a 400. */
export async function requireRegisteredFile(tx: Tx, fileId: string, companyId: string, purpose: Purpose) {
  const [f] = await tx.select().from(files).where(and(eq(files.id, fileId), eq(files.companyId, companyId), eq(files.purpose, purpose), isNotNull(files.sha256)));
  if (!f) throw new AppError(400, "file_missing", "Upload the file first.");
  return f;
}

/** True when any other stored file, in any business, has the same SHA-256 ("proof used before"). */
export async function shaSeenElsewhere(tx: Tx, sha256: string, exceptFileId: string) {
  const r = await tx.execute<{ seen: boolean }>(sql`select file_sha_seen(${sha256}, ${exceptFileId}) as seen`);
  return r.rows[0]?.seen === true;
}
