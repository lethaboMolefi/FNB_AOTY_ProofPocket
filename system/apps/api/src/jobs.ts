// Scheduled jobs (Cloud Run Job). Runs as the database owner.
//   daily:  expire payment requests after 7 days; mark documents past their "valid until" date as expired;
//           check the audit log's hash chain and export yesterday's entries (plus the latest hash) to storage;
//           delete what the retention schedule says to (docs/security/popia/retention-schedule.md)
//   weekly: re-check every stored document against its SHA-256 fingerprint (tampering)
import { createHash } from "node:crypto";
import { addDays, DOCS, PAYMENT_REQUEST_DAYS, todayZA, type DocType } from "@proofpocket/shared";
import pg from "pg";
import type { Config } from "./config";
import { gcsStore, localStore, type FileStore } from "./lib/storage";
import { pgConfig } from "./db/pg-config";

export interface JobResult {
  requestsExpired: number; documentsExpired: number; filesChecked: number; filesMismatched: number; filesMissing: number;
  auditRowsChecked: number; auditChainOk: boolean; auditExported: number; uploadsPurged: number; rateLimitRowsPurged: number;
}

/** Abandoned uploads (started, never finished) are deleted after this long. */
export const ABANDONED_UPLOAD_HOURS = 24;
const EXPORTS = "audit-exports";
interface ExportHead { day: string; rowsChecked: number; headHash: string }

export async function runJobs(ownerUrl: string, store: FileStore | null, opts: { rehash: boolean; today?: string }): Promise<JobResult> {
  const today = opts.today ?? todayZA();
  const pool = new pg.Pool({ ...pgConfig(ownerUrl), max: 1 });
  const out: JobResult = {
    requestsExpired: 0, documentsExpired: 0, filesChecked: 0, filesMismatched: 0, filesMissing: 0,
    auditRowsChecked: 0, auditChainOk: true, auditExported: 0, uploadsPurged: 0, rateLimitRowsPurged: 0,
  };
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

    await auditChecks(pool, store, today, out);
    await retention(pool, store, out);
    // One row per run, so the admin's Security & health page can show when jobs last ran and what they found.
    await pool.query(`insert into audit_log (actor_role, action, entity, after) values ('system', $1, 'job', $2)`,
      [opts.rehash ? "job.weekly" : "job.daily", JSON.stringify(out)]);
  } finally {
    await pool.end();
  }
  return out;
}

/** Verifies the hash chain, then exports yesterday's entries and the latest hash outside the database. */
async function auditChecks(pool: pg.Pool, store: FileStore | null, today: string, out: JobResult) {
  const v = (await pool.query<{ rows_checked: string; first_broken_seq: string | null; head_hash: string | null }>("select * from audit_log_verify()")).rows[0]!;
  out.auditRowsChecked = Number(v.rows_checked);
  out.auditChainOk = v.first_broken_seq === null;
  if (!store) return;
  const day = addDays(today, -1);
  // The previous export's head must still be in the chain: catches entries cut off the end since then.
  try {
    const prev = JSON.parse((await store.read(`${EXPORTS}/${addDays(day, -1)}.head.json`)).toString()) as ExportHead;
    const r = await pool.query<{ hash: string }>("select hash from audit_log where chain_seq = $1", [prev.rowsChecked]);
    if (r.rows[0]?.hash !== prev.headHash) out.auditChainOk = false;
  } catch { /* first export, or the previous day's run was missed */ }
  const rows = await pool.query(`select * from audit_log where (at at time zone 'Africa/Johannesburg')::date = $1::date order by chain_seq`, [day]);
  await store.save(`${EXPORTS}/${day}.jsonl`, Buffer.from(rows.rows.map((r) => JSON.stringify(r)).join("\n") + (rows.rows.length ? "\n" : "")), "application/x-ndjson");
  if (out.auditChainOk && v.head_hash) {
    const head: ExportHead = { day, rowsChecked: out.auditRowsChecked, headHash: v.head_hash };
    await store.save(`${EXPORTS}/${day}.head.json`, Buffer.from(JSON.stringify(head)), "application/json");
  }
  out.auditExported = rows.rowCount ?? 0;
}

/** Deletes data the retention schedule says not to keep. Business records themselves are kept (5 years, Tax Administration Act). */
async function retention(pool: pg.Pool, store: FileStore | null, out: JobResult) {
  const r = await pool.query("delete from rate_limit_hits where reset_at < now() - interval '1 day'");
  out.rateLimitRowsPurged = r.rowCount ?? 0;
  // Email confirmation codes last 10 minutes; nothing needs them after a day.
  await pool.query("delete from email_codes where expires_at < now() - interval '1 day'");
  if (!store) return;
  const abandoned = await pool.query<{ id: string; bucket_path: string }>(
    `select id, bucket_path from files where sha256 is null and created_at < now() - make_interval(hours => $1)`, [ABANDONED_UPLOAD_HOURS]);
  for (const f of abandoned.rows) {
    await store.remove(f.bucket_path);
    await pool.query("delete from files where id = $1 and sha256 is null", [f.id]);
    out.uploadsPurged++;
  }
}

// Run as a script: node dist/jobs.js [--rehash]
if (/jobs\.(ts|js)$/.test(process.argv[1] ?? "")) {
  const url = process.env.DATABASE_OWNER_URL;
  if (!url) throw new Error("DATABASE_OWNER_URL is required");
  const store = process.env.STORAGE_MODE === "gcs" && process.env.GCS_BUCKET ? gcsStore(process.env.GCS_BUCKET)
    : process.env.STORAGE_DIR ? localStore({ STORAGE_DIR: process.env.STORAGE_DIR, OTP_SECRET: process.env.OTP_SECRET ?? "" } as Config) : null;
  const rehash = process.argv.includes("--rehash") || new Date().getUTCDay() === 0;
  const result = await runJobs(url, store, { rehash });
  // Cloud Logging turns console.error into an ERROR entry, which the log-based alert watches (infra/deploy.sh logging).
  if (!result.auditChainOk || result.filesMismatched) console.error(JSON.stringify({ alert: "integrity", ...result }));
  else console.log(JSON.stringify(result));
}
