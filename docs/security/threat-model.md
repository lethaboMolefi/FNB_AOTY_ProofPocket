# Threat model and risk assessment

**System:** ProofPocket (PWA, API, database and storage in Google Cloud africa-south1)
**Method:** STRIDE per trust boundary, then a risk register scored likelihood × impact (1–5 each)
**Last reviewed:** 25 October 2026. Review again whenever a new role, data type, integration or region is added.

## 1. What we protect

| Asset | Why it matters | Where it lives |
|---|---|---|
| Founders' identity and company documents (ID, CIPC, bank letter, proof of address) | Identity theft, fraud, POPIA special care | Private Cloud Storage bucket; metadata and SHA-256 in `files` and `documents` |
| Founders' payment details | Redirecting a client's payment to a fraudster | `payment_details`; account number AES-256-GCM encrypted, only the last 4 digits shown |
| Books, stock, payment requests and proofs | Funding decisions are based on them | Cloud SQL (private IP only) |
| Readiness score and Verified status | Funders and buyers trust them | Computed on the server only; `verified_at` protected by trigger |
| Funding offers and decisions | Fairness and accountability to founders | `offers` (append-only), `applications`, `audit_log` |
| Accounts and two-step secrets | Taking over someone's account | Firebase Auth; TOTP secrets encrypted in `user_totp` |
| Audit log | Proving who did what | `audit_log` (append-only, hash-chained, exported nightly) |

## 2. People and trust boundaries

```
 Public / client ──(1)── Web app (Firebase Hosting) ──(2)── API (Cloud Run) ──(3)── Cloud SQL (private IP)
 Founder, funder,          static files, CSP, HSTS          Firebase token check,    RLS as proofpocket_app,
 adviser, admin                                              roles from the DB,       triggers, audit chain
                                                             Zod validation
                                       Browser ──(4)── Cloud Storage (5-minute signed URLs, private bucket)
                                       API ──(5)── Firebase Auth, Gmail SMTP (outside the VPC)
```

Boundaries: (1) internet to static site, (2) browser to API, (3) API to database, (4) browser to storage, (5) API to third-party services.

## 3. STRIDE

| Threat | Example against ProofPocket | Controls in place | Evidence (automated) |
|---|---|---|---|
| **S**poofing | Stolen password used to change payout details | Firebase Auth; Google Authenticator required for funder, adviser and admin, optional for founders; a code is needed to change payment details; lockout after 5 wrong codes | `auth.test.ts`, `api.test.ts` (lockout), `totp.test.ts`, `payments.test.ts`, e2e `shell.spec.ts` |
| | Forged session or dev token | Firebase ID tokens verified with revocation check; `AUTH_MODE=dev/local` refused in production by config | `security.test.ts` (forged token), `api.test.ts` (config) |
| | Fake "bank" message to a founder | Message checker flags risk signs; verified-sender badge only for system messages | `rules/phase45.test.ts` |
| **T**ampering | Client edits readiness, Verified or support stage | Readiness computed on the server; triggers refuse changes to protected columns | `rls-security.test.ts` |
| | Document swapped after it was checked | SHA-256 at upload; weekly re-hash job raises a warning | `jobs.test.ts` |
| | Audit entry rewritten by someone with database access | Append-only trigger and no UPDATE/DELETE grant; hash chain; nightly export of entries and head hash | `security.test.ts` (chain), `rls.test.ts` |
| | Reused or edited proof of payment | Amount, reference, date and method checks; SHA-256 seen-before across all businesses | `payments.test.ts` |
| **R**epudiation | Funder denies changing an offer | Offers append-only and need a reason; every decision in `audit_log` with actor, role and request id | `rls-security.test.ts` (offer history) |
| **I**nformation disclosure | One founder reads another's books by changing an id (IDOR) | RLS on every table; API checks role; access through `withContext()` | `rls.test.ts`, `security.test.ts` (RLS coverage, IDOR) |
| | Funder sees a company that didn't consent | `app_company_access()` gives funders access only to Verified companies with sharing on, or their own applicants at summary level | `rls.test.ts`, `security.test.ts` |
| | Personal data in logs | pino redaction of tokens, cookies, passwords, codes, account and ID numbers; bodies never logged | `security.test.ts` (logs) |
| | Stolen phone shows cached data | Only the founder's own API reads are cached; cleared on sign-out; documents and proofs never cached | `lib/cache-rules.ts` (allow-list), e2e `shell.spec.ts` (offline) |
| | Database traffic intercepted inside Google's network | Cloud SQL `ENCRYPTED_ONLY`; API verifies the server certificate (verify-ca) | `security.test.ts` (config); live deploy |
| **D**enial of service | Password guessing or upload flooding | Rate limits in Postgres shared by all instances; 5 MB upload limit; 100 kB JSON limit; Cloud Run max 4 instances; budget alert | `security.test.ts` (rate limits, sizes) |
| **E**levation of privilege | Founder sends `role=admin` | Roles read from the database only; users can't change their own role, organisation or email (trigger) | `rls.test.ts`, `security.test.ts` |
| | Stored script runs in an admin's browser (XSS) | React escapes output; strict CSP (`script-src 'self'`, no inline scripts); uploads served as sandboxed attachments | e2e `security.spec.ts`, `security.test.ts`, ZAP |
| | Over-privileged cloud accounts | API service account has only the roles it needs. The default compute account still has Editor, which needs the owner (see `not-implemented.md`) | `infra/deploy.sh iam_hardening` |

## 4. Risk register

Scores: likelihood (L) and impact (I) from 1 (low) to 5 (high). Residual risk is the score after the controls above.

| # | Risk | L | I | Inherent | Main controls | Residual | Owner |
|---|---|---|---|---|---|---|---|
| R1 | Account takeover redirects client payments | 4 | 5 | 20 | Google Authenticator, a code to change payment details, adviser notified, lockout | 6 | Engineering |
| R2 | Fake or reused proof of payment | 4 | 4 | 16 | Five proof checks, SHA-256 across all businesses, "Not received" twice = flagged | 6 | Engineering |
| R3 | Cross-tenant data leak (IDOR or RLS gap) | 3 | 5 | 15 | RLS everywhere (coverage test), API role checks, regression tests | 4 | Engineering |
| R4 | Malicious upload (script, polyglot, oversized) | 3 | 4 | 12 | File signature check, size limit, signed URLs, sandboxed attachment download | 3 | Engineering |
| R5 | Stored XSS | 2 | 4 | 8 | React escaping, strict CSP, ZAP | 2 | Engineering |
| R6 | Insider or attacker edits records or audit log | 2 | 5 | 10 | Append-only tables, triggers, hash chain, nightly export | 4 | Engineering |
| R7 | Supply-chain compromise (npm package) | 3 | 5 | 15 | Exact pins, 24-hour release age, build-script allow-list, `pnpm audit`, SBOM, Dependabot cooldown | 6 | Engineering |
| R8 | Secret leaked in git | 2 | 5 | 10 | gitleaks in CI, Secret Manager, generated test keys | 3 | Engineering |
| R9 | Personal data processed without a lawful basis or kept too long (POPIA) | 3 | 4 | 12 | Consent with notice version, retention jobs, data export and requests | 6 until signed off | Information Officer |
| R10 | Cloud misconfiguration (public bucket, broad IAM) | 2 | 5 | 10 | Public access prevention, uniform access, private DB IP; Editor on compute SA still open | 8 until `iam_hardening` runs | Project owner |
| R11 | Loss of data (deletion, ransomware) | 2 | 5 | 10 | Daily Cloud SQL backups (7 kept), deletion protection, bucket versioning (30 days) | 4 | Project owner |
| R12 | Denial of service or cost blow-up | 3 | 3 | 9 | Rate limits, max instances, USD 40 budget alert | 4 | Project owner |
| R13 | Undetected incident (no alerting) | 3 | 4 | 12 | Integrity job output, logs; the alert policy still needs an on-call email | 8 until `logging` runs | Project owner |

Risks R9, R10 and R13 stay above the go-live threshold (residual ≤ 6) until the owner actions in `not-implemented.md` are done.
