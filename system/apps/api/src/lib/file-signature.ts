// Works out a file's real type from its first bytes, so a renamed file can't pass as a PDF or photo.
export type DetectedType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "text/csv";

const starts = (b: Buffer, bytes: number[], offset = 0) => bytes.every((x, i) => b[offset + i] === x);

export function detectType(b: Buffer): DetectedType | null {
  if (starts(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  if (looksLikeText(b)) return "text/csv";
  return null;
}

/** UTF-8 text with no NUL or other control bytes (other than tab and line breaks). */
function looksLikeText(b: Buffer): boolean {
  const sample = b.subarray(0, 4096);
  for (const x of sample) if (x === 0 || (x < 0x20 && x !== 0x09 && x !== 0x0a && x !== 0x0d)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, Math.max(0, sample.length - 4))); return true; } catch { return false; }
}
