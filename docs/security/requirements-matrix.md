# Security requirements matrix

Each security requirement, how ProofPocket meets it, and the evidence. **Done** means it's built and checked automatically. **Owner** means it's built or scripted but needs the project owner or the team to finish it (details in `not-implemented.md`). **People** means it can only be done by a person.

## Secure development lifecycle

| Stage | Requirement | Status | How | Evidence |
|---|---|---|---|---|
| Requirements | Security and privacy requirements written down | Done | This matrix; brief section 8 rules; `asvs-l1.md` | This file |
| Design | Risk assessment | Done | Risk register R1–R13 with owners | `threat-model.md` §4 |
| Design | STRIDE threat model | Done | Per trust boundary | `threat-model.md` §3 |
| Build | Secure coding standard | Done | Rules for routes, RLS, validation, logging, secrets, dependencies | `secure-coding.md`, PR checklist |
| Build | Static analysis (SAST) | Done | ESLint security rules and Semgrep (`p/default`, `p/typescript`, `p/nodejsscan`) on every push and PR | CI `checks`, `semgrep` |
| Build | Secret scanning | Done | gitleaks over the full history | CI `gitleaks` |
| Build | Dependency checks (SCA) | Done | `pnpm audit --audit-level high`, exact pins, 24-hour release age, build-script allow-list, weekly re-run, Dependabot with a 1-day cooldown | CI `checks`, `.github/dependabot.yml` |
| Build | Software bill of materials | Done | CycloneDX from `pnpm sbom` on every build | CI `sbom` artifact |
| Build | Peer review of every change | Owner + People | CODEOWNERS and PR checklist exist; branch protection and a second reviewer are needed | `.github/CODEOWNERS` |
| Test | Unit and API tests for business rules | Done | 46 shared-rule tests, 130 API tests | `pnpm test` |
| Test | Security regression tests | Done | RLS coverage, IDOR, role tampering, forged tokens, XSS, SQL injection, uploads, link expiry, rate limits, audit chain, log redaction, privacy | `apps/api/test/security.test.ts`, `rls*.test.ts`, e2e `security.spec.ts` |
| Test | Dynamic scan (DAST) | Done | OWASP ZAP baseline on the web build and the API in CI; weekly on the hosted site | CI `zap`, `.github/workflows/zap-hosted.yml`, `security-testing.md` |
| Test | Manual security checks | Done (automated) + People | Every manual check in the requirements has an automated test; an independent penetration test is still needed | `security-testing.md` §3 |
| Deploy | Hosted in South Africa (africa-south1) | Done | Cloud Run, Cloud SQL, Cloud Storage, Artifact Registry, Secret Manager in africa-south1 | `infra/deploy.sh` |
| Deploy | Private database | Done | Private IP only, `ENCRYPTED_ONLY`, verify-ca from the API | `deploy.sh database`, `pg-config.ts` |
| Deploy | Secrets out of code | Done | Secret Manager; generated keys; config refuses dev auth, console mail and local storage in production | `config.ts`, `api.test.ts` |
| Deploy | Least privilege in the cloud | Owner | API service account is scoped. Removing Editor from the default compute account and a dedicated build account are scripted | `deploy.sh iam_hardening` |
| Deploy | Logging and alerting | Owner | Integrity events logged as errors; regional log bucket and alert metric scripted | `deploy.sh logging` |
| Operate | Backups and recovery | Done | Cloud SQL daily backups (7 kept), deletion protection, bucket versioning (30 days) | `deploy.sh database`, `storage` |
| Operate | Incident response plan | Done (draft) + People | Roles, severity levels, 72-hour POPIA notification steps | `incident-response.md` |
| Go-live | Security sign-off | People | Go-live gate checklist | `go-live-checklist.md` |
| Go-live | POPIA sign-off by Obakeng | People | Privacy notice, register, retention and request process are ready for review | `popia/` |

## Application controls (brief section 8 and the security requirements)

| Requirement | Status | How | Evidence |
|---|---|---|---|
| Server-side authorisation on every route | Done | `requireUser(roles)`; roles from the database | `api.test.ts`, `security.test.ts` |
| Row-level security as a second layer | Done | Every table has RLS; `withContext()` sets role and user | `rls.test.ts`, RLS coverage test |
| Two-step sign-in, Google Authenticator only | Done | TOTP (RFC 6238), single-use steps, lockout, admin reset | `totp.test.ts`, `auth.test.ts`, `api.test.ts` |
| Sign-in lockout and rate limits | Done | 5 wrong passwords or codes lock the account; per-IP limits shared across instances | `auth.test.ts`, `security.test.ts` |
| Input validation | Done | Zod schemas in `packages/shared` on every body | All API tests |
| Output encoding and CSP | Done | React escaping; strict CSP; `nosniff`; `frame-ancestors 'none'` | e2e `security.spec.ts`, ZAP |
| Safe file uploads | Done | Signed 5-minute URLs, fixed size and type, file-signature check, SHA-256, sandboxed download | `security.test.ts`, `join.test.ts` |
| Encryption in transit | Done | HTTPS with HSTS preload; TLS to the database with certificate check | ZAP, live checks |
| Encryption at rest | Done | Google default encryption; account numbers and TOTP secrets AES-256-GCM in the app | `api.test.ts` |
| No sensitive data in logs | Done | Redaction list; request bodies never logged | `security.test.ts` (logs) |
| Append-only, tamper-evident audit log | Done | No UPDATE/DELETE grant, trigger, hash chain, nightly export | `rls.test.ts`, `security.test.ts`, `jobs.test.ts` |
| Funders see only consented data | Done | `app_company_access()`; sharing none, summary or full | `rls.test.ts`, `security.test.ts` |
| Changed supplier bank details are held | Done | Payments blocked until confirmed | `payments.test.ts`, e2e |
| Never hold or move money, no bank or social APIs | Done | Design rule; share links only | Code review, `secure-coding.md` |
| Offline data scoped to the account | Done | Outbox entries carry the owner; cache cleared at sign-out; warning about unsent items | e2e `books.spec.ts`, `TopBar.tsx` |

## POPIA

| Condition (POPIA chapter 3) | Status | How | Evidence |
|---|---|---|---|
| Accountability (s8) | People | Information Officer to be appointed and registered | `popia/processing-register.md` |
| Processing limitation, consent (s9–11) | Done | Consent at joining, with the notice version recorded | `companies.consent_version`, `security.test.ts` |
| Purpose specification and retention (s13–14) | Done (draft) | Retention schedule with automated deletion of what needn't be kept | `popia/retention-schedule.md`, `jobs.ts` |
| Openness, notice (s18) | Done (draft) | `/privacy-notice`, linked at joining | `popia/privacy-notice.md`, e2e |
| Security safeguards (s19) | Done | Everything in this matrix | This file |
| Breach notification (s22) | Done (draft) | Incident plan with the Information Regulator's form and the 72-hour target | `incident-response.md` |
| Access and correction (s23–25) | Done | Download my data; correction and deletion requests reach admin's Reports | `security.test.ts`, e2e |
| Cross-border transfer (s72) | Done (draft) | Register of services outside South Africa | `popia/cross-border-register.md` |
| Prior authorisation, impact assessment | People | Information Officer decides | `not-implemented.md` |
