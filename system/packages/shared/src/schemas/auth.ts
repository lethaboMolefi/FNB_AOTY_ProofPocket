import { z } from "zod";

export const roleSchema = z.enum(["founder", "funder", "adviser", "buyer", "admin"]);

export const otpPurposeSchema = z.enum(["sign_in", "payment_details", "two_factor"]);
export const otpRequestSchema = z.object({ purpose: otpPurposeSchema });
export const pinSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit PIN from your email");
export const otpVerifySchema = z.object({ purpose: otpPurposeSchema, code: pinSchema });

// Passwords people actually choose; blocked outright.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop", "1234567890", "12345678910", "123456789",
  "iloveyou1", "letmein123", "welcome123", "admin12345", "abc1234567", "proofpocket", "sunshine12", "football12", "monkey12345",
]);

/** At least 10 characters, not a common password and not built from the email name. */
export const passwordFor = (email?: string) =>
  z.string()
    .min(10, "Use at least 10 characters. A short sentence works well.")
    .max(128, "Use 128 characters or fewer.")
    .refine((p) => !COMMON.has(p.toLowerCase()), "That password is too common. Choose another.")
    .refine((p) => {
      const name = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
      return name.length < 4 || !p.toLowerCase().includes(name);
    }, "Don't use your email name in your password.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter your email address");

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(128) });
export const signUpSchema = z.object({ email: emailSchema, password: z.string() }).superRefine((v, ctx) => {
  const r = passwordFor(v.email).safeParse(v.password);
  if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]!.message });
});

export const twoFactorSchema = z.object({ enabled: z.boolean(), code: pinSchema });

export const meSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: roleSchema,
  org: z.object({ id: z.string().uuid(), name: z.string(), type: z.enum(["funder", "incubator", "buyer"]), verified: z.boolean(), setupDone: z.boolean() }).nullable(),
  /** Founders only: the business they own. */
  company: z.object({
    id: z.string().uuid(), name: z.string(), town: z.string(), province: z.string(),
    businessType: z.enum(["beauty", "food", "retail", "recycling", "trades", "services"]), verified: z.boolean(),
    /** False until the Join wizard is finished. */
    joined: z.boolean(),
  }).nullable(),
  /** Must enter an email PIN before continuing this sign-in. */
  needsOtp: z.boolean(),
  twoFactor: z.object({ enabled: z.boolean(), required: z.boolean() }),
});
export type Me = z.infer<typeof meSchema>;
