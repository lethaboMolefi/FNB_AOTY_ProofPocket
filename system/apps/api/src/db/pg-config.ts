// Connection settings for every database pool (API, migrations, bootstrap, jobs).
import type pg from "pg";

/**
 * With DATABASE_CA_CERT_B64 (the Cloud SQL server CA, PEM, base64) the connection is encrypted and the server
 * certificate must chain to that CA (verify-ca). Cloud SQL's certificate names the instance, not its private IP,
 * so the host name isn't compared. Without it, the URL's own sslmode applies (local Docker has no TLS).
 */
export function pgConfig(url: string, caB64 = process.env.DATABASE_CA_CERT_B64): pg.PoolConfig {
  if (!caB64) return { connectionString: url };
  // pg lets sslmode in the URL override the ssl object, so it's taken out.
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  const ca = Buffer.from(caB64, "base64").toString("utf8");
  if (!ca.includes("BEGIN CERTIFICATE")) throw new Error("DATABASE_CA_CERT_B64 isn't a PEM certificate");
  return { connectionString: u.toString(), ssl: { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined } };
}
