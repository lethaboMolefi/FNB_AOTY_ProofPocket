// Reads the text lines out of a bank statement PDF (in memory; nothing is written anywhere). Text pieces are grouped
// into lines by their position on the page, so each transaction row comes out as one line, left to right.
import { getDocumentProxy } from "unpdf";
import { AppError } from "./errors";

interface Piece { str: string; x: number; y: number; w: number }

export async function pdfTextLines(pdf: Buffer, password?: string): Promise<string[]> {
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    doc = await getDocumentProxy(new Uint8Array(pdf), { password: password || undefined });
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err.name === "PasswordException") {
      throw err.code === 2
        ? new AppError(400, "pdf_password_wrong", "That password isn't right. Banks often use your ID number or account number; check the email that came with the statement.")
        : new AppError(400, "pdf_password", "This statement PDF has a password. Enter it to import the statement.");
    }
    throw new AppError(400, "pdf_unreadable", "We couldn't read that PDF. Download the statement again from your banking app and try once more.");
  }
  const lines: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const items = (await page.getTextContent()).items as { str?: string; transform?: number[]; width?: number }[];
    const pieces: Piece[] = items.filter((i) => i.str && i.str.trim() && i.transform).map((i) => ({ str: i.str!, x: i.transform![4]!, y: i.transform![5]!, w: i.width ?? 0 }));
    // Rows: pieces whose baselines are within 2 points of each other, top of the page first.
    const rows: Piece[][] = [];
    for (const p of pieces.sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find((r) => Math.abs(r[0]!.y - p.y) <= 2);
      if (row) row.push(p); else rows.push([p]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      let text = "";
      let end = -Infinity;
      for (const p of row) {
        // Pieces that touch are one word (kerned text); a gap is a space or a new column.
        text += (text && p.x - end > 1 ? " " : "") + p.str;
        end = p.x + p.w;
      }
      const clean = text.replace(/\s+/g, " ").trim();
      if (clean) lines.push(clean);
    }
  }
  await doc.cleanup?.();
  if (!lines.some((l) => /\d/.test(l))) {
    throw new AppError(400, "pdf_no_text", "This PDF has no text in it: it looks scanned or photographed. Download the statement PDF from your banking app instead.");
  }
  return lines;
}
