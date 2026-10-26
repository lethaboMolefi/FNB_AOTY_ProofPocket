// Run on the operator's own machine, after the add-admins job: sets a unique temporary password in Firebase
// Authentication for each email (creates the sign-in, or replaces the password when re-issuing) and prints the table
// once, here only. Nothing is written to a file, a log, the database or Cloud Run. Uses the operator's gcloud sign-in.
//   tsx scripts/firebase-temp-passwords.ts PROJECT_ID email1 email2 …
import { execFileSync } from "node:child_process";
import { generateTempPassword, printPasswordTable } from "../src/db/admin-accounts";

const [project, ...emails] = process.argv.slice(2);
if (!project || !emails.length) throw new Error("Usage: tsx scripts/firebase-temp-passwords.ts PROJECT_ID email…");
const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const base = `https://identitytoolkit.googleapis.com/v1/projects/${project}`;
const call = async (path: string, body: object) => {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "x-goog-user-project": project, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as Record<string, unknown> & { error?: { message: string } };
  // Never echo the request (it holds the password); Firebase's error message doesn't.
  if (!res.ok) throw new Error(`Firebase ${path}: ${json.error?.message ?? res.status}`);
  return json;
};

const table: { email: string; password: string }[] = [];
for (const raw of emails) {
  const email = raw.trim().toLowerCase();
  const password = generateTempPassword();
  const found = (await call("/accounts:lookup", { email: [email] })) as { users?: { localId: string }[] };
  const localId = found.users?.[0]?.localId;
  if (localId) await call("/accounts:update", { localId, password, emailVerified: true });
  else await call("/accounts", { email, password, emailVerified: true, displayName: "ProofPocket admin" });
  table.push({ email, password });
}
printPasswordTable(table);
