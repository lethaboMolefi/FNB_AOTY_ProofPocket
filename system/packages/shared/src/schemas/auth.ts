import { z } from "zod";

export const roleSchema = z.enum(["founder", "funder", "adviser", "buyer", "admin"]);

export const otpRequestSchema = z.object({ purpose: z.enum(["sign_in", "payment_details"]) });
export const otpVerifySchema = z.object({
  purpose: z.enum(["sign_in", "payment_details"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit PIN from your email"),
});

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: roleSchema,
  org: z.object({ id: z.string().uuid(), name: z.string(), type: z.enum(["funder", "incubator", "buyer"]), verified: z.boolean(), setupDone: z.boolean() }).nullable(),
  companyId: z.string().uuid().nullable(),
  /** Funder, adviser and admin users must enter an email PIN after each sign-in. */
  needsOtp: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;
