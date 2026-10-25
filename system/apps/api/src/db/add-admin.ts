// Cloud Run Job (infra/deploy.sh add_admin EMAIL): makes EMAIL a ProofPocket admin. Idempotent.
// No password: the person signs in with Continue with Google (or Firebase email), the verified email links the
// account, and Google Authenticator set-up is required at first sign-in.
import pg from "pg";
import { pgConfig } from "./pg-config";

const ownerUrl = process.env.DATABASE_OWNER_URL;
const email = (process.env.ADMIN_EMAIL ?? process.argv[2] ?? "").trim().toLowerCase();
if (!ownerUrl) throw new Error("DATABASE_OWNER_URL is required");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Give the admin's email: ADMIN_EMAIL=… or an argument");

const pool = new pg.Pool({ ...pgConfig(ownerUrl), max: 1 });
try {
  const existing = (await pool.query<{ id: string; role: string }>("select id, role from users where lower(email) = $1", [email])).rows[0];
  if (existing?.role === "admin") console.log(`${email} is already an admin`);
  else if (existing) throw new Error(`${email} already has a ${existing.role} account; change it by hand if that's intended`);
  else {
    const u = (await pool.query<{ id: string }>("insert into users (email, display_name, role) values ($1, 'ProofPocket admin', 'admin') returning id", [email])).rows[0]!;
    await pool.query("insert into audit_log (actor_role, action, entity, entity_id, after) values ('system', 'admin.added', 'user', $1, $2)", [u.id, JSON.stringify({ email })]);
    console.log(`${email} is now an admin. Sign in with Continue with Google; Google Authenticator set-up comes first.`);
  }
} finally {
  await pool.end();
}
