import { z } from "zod";

const key32 = z.string().refine((s) => Buffer.from(s, "base64").length === 32, "must be 32 bytes, base64");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  /** firebase = production. local = email + password stored by the API (development). dev = test tokens (tests only). */
  AUTH_MODE: z.enum(["firebase", "local", "dev"]).default("firebase"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  ACCOUNT_NUMBER_KEY: key32,
  OTP_SECRET: key32,
  /** console = print to the log; file = write .eml files to MAIL_DIR (tests); smtp = send through Gmail. */
  MAIL_MODE: z.enum(["console", "file", "smtp"]).default("console"),
  MAIL_DIR: z.string().default(".local-mail"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("ProofPocket <no-reply@proofpocket.example>"),
  /** local = files on disk under STORAGE_DIR (development); gcs = private Cloud Storage bucket. */
  STORAGE_MODE: z.enum(["local", "gcs"]).default("local"),
  STORAGE_DIR: z.string().default(".local-uploads"),
  GCS_BUCKET: z.string().optional(),
  /** Where people open ProofPocket; used in payment links and emails. */
  PUBLIC_WEB_URL: z.string().default("http://localhost:5173"),
}).superRefine((c, ctx) => {
  if (c.NODE_ENV === "production" && c.AUTH_MODE !== "firebase") ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "production must use Firebase Authentication" });
  if (c.AUTH_MODE === "dev" && c.NODE_ENV !== "test") ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "dev tokens are for automated tests only; use AUTH_MODE=local" });
  if (c.NODE_ENV === "production" && c.MAIL_MODE !== "smtp") ctx.addIssue({ code: "custom", path: ["MAIL_MODE"], message: "production must send real email" });
  if (c.AUTH_MODE === "firebase" && !c.FIREBASE_PROJECT_ID) ctx.addIssue({ code: "custom", path: ["FIREBASE_PROJECT_ID"], message: "required with AUTH_MODE=firebase" });
  if (c.NODE_ENV === "production" && c.STORAGE_MODE !== "gcs") ctx.addIssue({ code: "custom", path: ["STORAGE_MODE"], message: "production must store files in Cloud Storage" });
  if (c.STORAGE_MODE === "gcs" && !c.GCS_BUCKET) ctx.addIssue({ code: "custom", path: ["GCS_BUCKET"], message: "required with STORAGE_MODE=gcs" });
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
