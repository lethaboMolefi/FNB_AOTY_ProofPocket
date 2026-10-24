// Scheduled jobs (Cloud Run Job, started by Cloud Scheduler). Runs as the database owner.
//   daily:  expire payment requests after 7 days; mark documents past their "valid until" date as expired
//   weekly: re-check every stored document against its SHA-256 fingerprint (tampering)
import { createHash } from "node:crypto";
import { DOCS, PAYMENT_REQUEST_DAYS, todayZA, type DocType } from "@proofpocket/shared";
import pg from "pg";
import type { Config } from "./config";
import { gcsStore, localStore, type FileStore } from "./lib/storage";

export interface JobResult { requestsExpired: number; documentsExpired: number; filesChecked: number; filesMismatched: number; filesMissing: number }

export async function runJobs(ownerUrl: string, store: FileStore | null, opts: { rehash: boolean; today?: string }): Promise<JobResult> {
  const today = opts.today ?? todayZA();
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  const out: JobResult = { requestsExpired: 0, documentsExpired: 0, filesChecked: 0, filesMismatched: 0, filesMissing: 0 };
  try {
    const r = await pool.query(
      `update payment_requests set status = 'expired', updated_at = now()
       where status in ('waiting', 'not_received') and requested_on < ($1::date - $2::int) returning id`, [today, PAYMENT_REQUEST_DAYS]);
    out.requestsExpired = r.rowCount ?? 0;

    const d = await pool.query<{ id: string; company_id: string; doc_type: DocType }>(
      `update documents set status = 'expired', updated_at = now()
       where status = 'verified' and expires_on is not null and expires_on < $1::date returning id, company_id, doc_type`, [today]);
    for (const row of d.rows) {
      const name = DOCS[row.doc_type].name;
      await pool.query(`insert into messages (company_id, kind, sender, sender_address, verified_sender, body) values ($1, 'system', 'ProofPocket', 'Verified', true, $2)`,
        [row.company_id, `Your ${name} has expired. Upload a current one under Registration steps.`]);
      await pool.query(`insert into activity (company_id, text) values ($1, $2)`, [row.company_id, `${name} expired.`]);
    }
    out.documentsExpired = d.rowCount ?? 0;

    if (opts.rehash && store) {
      const files = await pool.query<{ id: string; company_id: string; bucket_path: string; sha256: string; doc_type: DocType | null }>(
        `select f.id, f.company_id, f.bucket_path, f.sha256, d.doc_type from files f
         left join documents d on d.file_id = f.id
         -- Example data has fingerprints but no stored files, so it's never checked.
         where f.sha256 is not null and f.purpose = 'document' and not f.is_example`);
      for (const f of files.rows) {
        out.filesChecked++;
        let actual: string | null = null;
        try { actual = createHash("sha256").update(await store.read(f.bucket_path)).digest("hex"); } catch { actual = null; }
        if (actual === f.sha256) continue;
        if (actual === null) out.filesMissing++; else out.filesMismatched++;
        const name = f.doc_type ? DOCS[f.doc_type].name : "A document";
        const what = actual === null ? "can't be found in storage" : "no longer matches the file that was checked";
        await pool.query(`insert into messages (company_id, kind, sender, sender_address, verified_sender, body, risk_flags) values ($1, 'system', 'ProofPocket', 'Verified', true, $2, $3)`,
          [f.company_id, `${name} ${what}. ProofPocket is looking into it; your adviser and funders see a warning.`, [actual === null ? "Document file missing" : "Document changed after it was checked"]]);
        await pool.query(`insert into audit_log (actor_role, action, entity, entity_id, company_id, after) values ('system', 'file.fingerprint_mismatch', 'file', $1, $2, $3)`,
          [f.id, f.company_id, JSON.stringify({ expected: f.sha256, found: actual ?? "missing" })]);
      }
    }
  } finally {
    await pool.end();
  }
  return out;
}

// Run as a script: node dist/jobs.js [--rehash]
if (/jobs\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  const store = process.env.STORAGE_MODE === "gcs" && process.env.GCS_BUCKET ? gcsStore(process.env.GCS_BUCKET)
    : process.env.STORAGE_DIR ? localStore({ STORAGE_DIR: process.env.STORAGE_DIR, OTP_SECRET: process.env.OTP_SECRET ?? "" } as Config) : null;
  const rehash = process.argv.includes("--rehash") || new Date().getUTCDay() === 0;
  console.log(JSON.stringify(await runJobs(url, store, { rehash })));
}
