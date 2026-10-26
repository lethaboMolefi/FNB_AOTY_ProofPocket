// Admin accounts with temporary passwords. Idempotent: existing emails are reported and skipped.
//   Production (Cloud Run job, infra/deploy.sh admins EMAIL…): database rows only. It prints results, never a password;
//     the operator's terminal then sets the passwords in Firebase (scripts/firebase-temp-passwords.ts).
//   Development (--local-passwords, against the local database): also sets the local sign-in and prints the table once.
//   --reissue: a new temporary password (7 more days) for admins who haven't set their own yet.
import pg from "pg";
import { adminRows, generateTempPassword, printPasswordTable, setLocalPassword } from "./admin-accounts";
import { pgConfig } from "./pg-config";

const ownerUrl = process.env.DATABASE_OWNER_URL;
if (!ownerUrl) throw new Error("DATABASE_OWNER_URL is required");
const args = process.argv.slice(2);
const emails = [...(process.env.ADMIN_EMAILS ?? "").split(","), ...args.filter((a) => !a.startsWith("--"))].map((e) => e.trim()).filter(Boolean);
if (!emails.length) throw new Error("Give the emails: ADMIN_EMAILS=a@x,b@y or arguments");
const local = args.includes("--local-passwords");
if (local && process.env.NODE_ENV === "production") throw new Error("--local-passwords is for development only");

const pool = new pg.Pool({ ...pgConfig(ownerUrl), max: 1 });
try {
  const results = await adminRows(pool, emails, { reissue: args.includes("--reissue") });
  // Machine-readable for infra/deploy.sh; emails and outcomes only.
  for (const r of results) console.log(`RESULT ${JSON.stringify(r)}`);
  if (local) {
    const table = [];
    for (const r of results.filter((x) => x.status !== "skipped")) {
      const password = generateTempPassword();
      await setLocalPassword(pool, r.email, password);
      table.push({ email: r.email, password });
    }
    if (table.length) printPasswordTable(table);
  }
} finally {
  await pool.end();
}
