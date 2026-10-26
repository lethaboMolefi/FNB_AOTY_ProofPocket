import { z } from "zod";
import { DOC_TYPES, MAX_UPLOAD_BYTES, type DocType } from "../constants";

/** Types accepted for documents, receipts and proofs of payment (checked again by file signature on the server). */
export const UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const STATEMENT_TYPES = ["application/pdf", "text/csv", "application/vnd.ms-excel", "text/plain"] as const;

export const uploadStartSchema = z.object({
  purpose: z.enum(["document", "receipt", "statement"]),
  name: z.string().trim().min(1).max(160),
  contentType: z.string(),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Files must be 5 MB or smaller"),
}).superRefine((u, ctx) => {
  const ok = u.purpose === "statement" ? (STATEMENT_TYPES as readonly string[]).includes(u.contentType) : (UPLOAD_TYPES as readonly string[]).includes(u.contentType);
  if (!ok) ctx.addIssue({ code: "custom", path: ["contentType"], message: u.purpose === "statement" ? "Upload the PDF statement from your banking app." : "Upload a PDF or a photo (JPG, PNG or WebP)." });
});

export const docTypeSchema = z.enum(DOC_TYPES as [DocType, ...DocType[]]);
export const documentCreateSchema = z.object({ docType: docTypeSchema, fileId: z.string().uuid() });

export const reviewApproveSchema = z.object({
  /** Optional: tax registrations and B-BBEE affidavits expire. */
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});
export const reviewRejectSchema = z.object({
  reason: z.string().trim().min(3, "Add a reason so the founder knows what to fix").max(300),
});
