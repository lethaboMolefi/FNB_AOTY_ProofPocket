import { z } from "zod";

/** Every API error has this shape: { error: { code, message } }. */
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const uuid = z.string().uuid();
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-24");
/** Rand amounts: positive, at most two decimals, below R10 000 000 000 (numeric(12,2)). */
export const amount = z.number().positive().max(9_999_999_999.99).multipleOf(0.01);
