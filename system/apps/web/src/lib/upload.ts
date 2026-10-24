// Upload flow: compress photos on the phone → ask the API for a signed URL → PUT → the API checks the file and fingerprints it.
import { MAX_UPLOAD_BYTES } from "@proofpocket/shared";
import { API_BASE, ApiError, api } from "./api";

const MAX_SIDE = 1600;
const TARGET_BYTES = 200 * 1024;

/** Photos are resized to at most 1600 px and re-encoded as JPEG near 200 KB, to save data. PDFs are left alone. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= TARGET_BYTES) return file;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const q of [0.82, 0.72, 0.62, 0.52]) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export interface Uploaded { fileId: string; sha256: string; name: string }

/** Uploads one file and returns its fingerprint. `base` is "/founder" or a public payment path. */
export async function uploadFile(file: File, purpose: "document" | "receipt" | "statement" | "proof", base = "/founder"): Promise<Uploaded> {
  const f = purpose === "statement" ? file : await compressImage(file);
  if (f.size > MAX_UPLOAD_BYTES) throw new ApiError(400, "too_large", "Files must be 5 MB or smaller");
  const contentType = f.type || (f.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/octet-stream");
  const start = await api<{ fileId: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } }>(
    `${base}/uploads`, { body: { purpose, name: f.name, contentType, size: f.size } });
  let put: Response;
  try {
    // Cloud Storage gives an absolute signed URL; the local stand-in gives a path on the API.
    const url = start.upload.url.startsWith("/") ? `${API_BASE}${start.upload.url}` : start.upload.url;
    put = await fetch(url, { method: "PUT", headers: start.upload.headers, body: f });
  } catch {
    throw new ApiError(0, "offline", "The upload didn't go through. Check your connection and try again.");
  }
  if (!put.ok) throw new ApiError(put.status, "upload_failed", "The upload didn't go through. Try again.");
  return api<Uploaded>(`${base}/uploads/${start.fileId}/complete`, { body: {} });
}
