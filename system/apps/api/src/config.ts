import { z } from "zod";

const key32 = z.string().refine((s) => Buffer.from(s, "base64").length === 32, "must be 32 bytes, base64");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  AUTH_MODE: z.enum(["firebase", "dev"]).default("firebase"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  ACCOUNT_NUMBER_KEY: key32,
  OTP_SECRET: key32,
  MAIL_MODE: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("ProofPocket <no-reply@proofpocket.example>"),
}).superRefine((c, ctx) => {
  if (c.NODE_ENV === "production" && c.AUTH_MODE === "dev") ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "dev sign-in is never allowed in production" });
  if (c.NODE_ENV === "production" && c.MAIL_MODE === "console") ctx.addIssue({ code: "custom", path: ["MAIL_MODE"], message: "production must send real email" });
  if (c.AUTH_MODE === "firebase" && !c.FIREBASE_PROJECT_ID) ctx.addIssue({ code: "custom", path: ["FIREBASE_PROJECT_ID"], message: "required with AUTH_MODE=firebase" });
  if (c.MAIL_MODE === "smtp" && (!c.SMTP_USER || !c.SMTP_PASS)) ctx.addIssue({ code: "custom", path: ["SMTP_PASS"], message: "SMTP_USER and SMTP_PASS are required with MAIL_MODE=smtp" });
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = schema.safeParse(env);
  if (!r.success) {
    // Names only: values may be secrets.
    const problems = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  return r.data;
}
