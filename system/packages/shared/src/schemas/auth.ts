import { z } from "zod";

export const roleSchema = z.enum(["founder", "funder", "adviser", "buyer", "admin"]);

/** A 6-digit code from Google Authenticator. */
export const authenticatorCode = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from Google Authenticator");
export const totpCodeSchema = z.object({ code: authenticatorCode });

// Passwords people actually choose; blocked outright.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop", "1234567890", "12345678910", "123456789",
  "iloveyou1", "letmein123", "welcome123", "admin12345", "abc1234567", "proofpocket", "sunshine12", "football12", "monkey12345",
]);

/** At least 12 characters (OWASP ASVS 2.1.1), not a common password and not built from the email name. */
export const passwordFor = (email?: string) =>
  z.string()
    .min(12, "Use at least 12 characters. A short sentence works well.")
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
    /** False when the founder agreed to an older privacy notice (or none) and must agree to the current one. */
    privacyNoticeCurrent: z.boolean(),
  }).nullable(),
  /** Must enter a Google Authenticator code (or set it up, if required) before continuing this sign-in. */
  needsOtp: z.boolean(),
  /** enabled = Google Authenticator is set up; required = funder, adviser and admin accounts. */
  twoFactor: z.object({ enabled: z.boolean(), required: z.boolean() }),
  /** Signed in with a temporary password: must set their own before anything else. */
  mustChangePassword: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

/** Setting your own password (after a temporary one, or from your profile). The server checks it against your email. */
export const newPasswordSchema = z.object({ current: z.string().min(1, "Enter your current (or temporary) password").max(128), password: z.string().max(128) });

/** An admin turning an account down or suspending it always gives a reason. */
export const accountReasonSchema = z.object({ reason: z.string().trim().min(10, "Give a reason (at least 10 characters)").max(500) });
